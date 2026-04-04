import { describe, expect, it } from "vitest";
import {
  buildToolDescriptionBlock,
  convertToolResultsForPrompt,
  injectToolSystemPrompt,
  parseToolCallsFromText
} from "../src/provider/deepseek/promptToolCalling.js";

describe("prompt tool calling", () => {
  it("renders XML tool descriptions", () => {
    const block = buildToolDescriptionBlock([
      {
        name: "read_file",
        description: "Read a file",
        inputSchema: { type: "object" },
        validator: {} as never,
        isReadOnly: true,
        requiresConfirmation: () => false,
        execute: async () => ({ success: true, output: "ok" })
      }
    ]);

    expect(block).toContain("<tool>");
    expect(block).toContain("<name>read_file</name>");
  });

  it("extracts tool calls and keeps visible text clean", () => {
    const parsed = parseToolCallsFromText(
      "Inspecting\n<tool_call>\n<name>read_file</name>\n<arguments>{\"path\":\"src/index.ts\"}</arguments>\n</tool_call>"
    );

    expect(parsed.cleanText).toBe("Inspecting");
    expect(parsed.toolCalls[0]?.name).toBe("read_file");
    expect(parsed.toolCalls[0]?.input).toEqual({ path: "src/index.ts" });
  });

  it("converts prior tool results into prompt-safe user messages", () => {
    const converted = convertToolResultsForPrompt([
      {
        id: "assistant-1",
        role: "assistant",
        content: "calling tool",
        createdAt: "2026-01-01T00:00:00.000Z",
        toolCalls: [{ id: "tool-1", name: "read_file", input: { path: "a.ts" } }]
      },
      {
        id: "tool-1",
        role: "tool",
        content: "content",
        createdAt: "2026-01-01T00:00:00.000Z",
        toolCallId: "tool-1"
      }
    ]);

    expect(converted[0]?.content).toContain("<tool_call>");
    expect(converted[1]?.role).toBe("user");
    expect(converted[1]?.content).toContain("<tool_result>");
    expect(injectToolSystemPrompt(converted, "tools")[0]?.role).toBe("system");
  });
});
