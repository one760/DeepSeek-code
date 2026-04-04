import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runConversationTurn } from "../src/core/runConversationTurn.js";
import { createSession } from "../src/services/storage.js";
import type { ModelEvent, ToolCall } from "../src/core/types.js";
import type { ToolDefinition } from "../src/tools/types.js";
import { z } from "zod";

function createToolCall(
  id: string,
  name: string,
  input: unknown
): ToolCall {
  return { id, name, input };
}

async function* createEventStream(
  events: ModelEvent[]
): AsyncIterable<ModelEvent> {
  for (const event of events) {
    yield event;
  }
}

describe("runConversationTurn", () => {
  const originalEnv = { ...process.env };
  let tempRoot = "";

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "deepseek-code-conversation-"));
    process.env.DEEPSEEK_CODE_HOME = tempRoot;
  });

  afterEach(async () => {
    process.env = { ...originalEnv };
    if (tempRoot) {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("executes a tool call and feeds the tool result back into a follow-up model turn", async () => {
    const session = createSession("/tmp/workspace", "deepseek-chat");
    const seenMessages: Array<Array<{ role: string; content: string; reasoningContent?: string }>> = [];
    let callIndex = 0;

    const provider = {
      async *streamChat(messages) {
        seenMessages.push(messages.map((message: { role: string; content: string; reasoningContent?: string }) => ({
          role: message.role,
          content: message.content,
          reasoningContent: message.reasoningContent
        })));

        if (callIndex === 0) {
          callIndex += 1;
          yield* createEventStream([
            { type: "text-delta", text: "I will inspect the file." },
            {
              type: "tool-calls",
              calls: [createToolCall("tool-1", "read_file", { path: "src/index.ts" })]
            },
            {
              type: "response-complete",
              usage: {
                inputTokens: 11,
                outputTokens: 7,
                totalTokens: 18
              },
              reasoningContent: "need file contents"
            }
          ]);
          return;
        }

        yield* createEventStream([
          { type: "text-delta", text: "The file contents have been reviewed." },
          { type: "response-complete" }
        ]);
      }
    } as {
      streamChat: (
        messages: Array<{ role: string; content: string }>
      ) => AsyncIterable<ModelEvent>;
    };

    const readFileTool: ToolDefinition<{ path: string }> = {
      name: "read_file",
      description: "Read file contents",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string" }
        },
        required: ["path"],
        additionalProperties: false
      },
      validator: z.object({
        path: z.string()
      }),
      isReadOnly: true,
      requiresConfirmation: () => false,
      execute: async ({ path: filePath }) => ({
        success: true,
        output: `CONTENTS:${filePath}`
      })
    };

    const updatedSession = await runConversationTurn({
      session,
      prompt: "Read src/index.ts",
      provider: provider as never,
      tools: [readFileTool],
      confirm: async () => "once",
      systemPromptContext: {
        workspaceRoot: "/tmp/workspace",
        model: "deepseek-chat",
        tools: [readFileTool]
      }
    });

    expect(updatedSession.messages.map((message) => message.role)).toEqual([
      "user",
      "assistant",
      "tool",
      "assistant"
    ]);
    expect(updatedSession.messages[1]?.toolCalls?.[0]?.name).toBe("read_file");
    expect(updatedSession.messages[2]?.content).toBe("CONTENTS:src/index.ts");
    expect(updatedSession.messages[3]?.content).toContain("reviewed");
    expect(updatedSession.messages.some((message) => message.role === "system")).toBe(false);
    expect(updatedSession.tokenUsage?.totalTokens).toBe(18);
    expect(seenMessages).toHaveLength(2);
    expect(seenMessages[0]?.[0]?.role).toBe("system");
    expect(
      seenMessages[1]?.some(
        (message) => message.role === "assistant" && message.reasoningContent === "need file contents"
      )
    ).toBe(true);
    expect(seenMessages[1]?.some((message) => message.role === "tool" && message.content === "CONTENTS:src/index.ts")).toBe(true);
  });
});
