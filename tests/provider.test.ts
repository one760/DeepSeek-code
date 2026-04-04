import { describe, expect, it } from "vitest";
import type { ChatCompletionChunk } from "openai/resources/chat/completions";
import {
  DeepSeekProvider,
  isReasonerModel,
  modelSupportsToolCalls
} from "../src/provider/deepseek/DeepSeekProvider.js";
import type { ResolvedConfig } from "../src/core/types.js";
import type { ToolDefinition } from "../src/tools/types.js";
import { z } from "zod";

async function* emptyStream(): AsyncIterable<ChatCompletionChunk> {
  yield {
    id: "chunk-1",
    object: "chat.completion.chunk",
    created: Date.now(),
    model: "deepseek-chat",
    choices: []
  };
}

function createTool(): ToolDefinition<{ path: string }> {
  return {
    name: "read_file",
    description: "Read file",
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
    execute: async () => ({
      success: true,
      output: "ok"
    })
  };
}

describe("DeepSeekProvider", () => {
  const config: ResolvedConfig = {
    apiKey: "test-key",
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-chat",
    sources: {
      apiKey: "override",
      baseUrl: "default",
      model: "default"
    }
  };

  it("sends tool definitions for non-reasoner models", async () => {
    let observedTools: unknown;
    const provider = new DeepSeekProvider(config, async (params) => {
      observedTools = params.tools;
      return emptyStream();
    });

    for await (const _event of provider.streamChat([], [createTool()], { model: "deepseek-chat" })) {
      // consume stream
    }

    expect(Array.isArray(observedTools)).toBe(true);
    expect((observedTools as Array<unknown>).length).toBe(1);
  });

  it("attempts native tool definitions for reasoner models", async () => {
    let observedTools: unknown;
    const provider = new DeepSeekProvider(config, async (params) => {
      observedTools = params.tools;
      return emptyStream();
    });

    for await (const _event of provider.streamChat([], [createTool()], { model: "deepseek-reasoner" })) {
      // consume stream
    }

    expect(Array.isArray(observedTools)).toBe(true);
    expect((observedTools as Array<unknown>).length).toBe(1);
  });

  it("falls back to prompt-based tool calling for reasoner capability errors", async () => {
    let callCount = 0;
    const provider = new DeepSeekProvider(config, async (params) => {
      callCount += 1;

      if (callCount === 1) {
        const error = new Error("400: tool role is not supported");
        (error as Error & { status?: number }).status = 400;
        throw error;
      }

      async function* fallbackStream(): AsyncIterable<ChatCompletionChunk> {
        yield {
          id: "chunk-2",
          object: "chat.completion.chunk",
          created: Date.now(),
          model: "deepseek-reasoner",
          choices: [
            {
              index: 0,
              finish_reason: null,
              delta: {
                role: "assistant",
                content:
                  "Inspecting.\n<tool_call>\n<name>read_file</name>\n<arguments>{\"path\":\"src/index.ts\"}</arguments>\n</tool_call>"
              }
            }
          ]
        };
      }

      return fallbackStream();
    });

    const events = [];
    for await (const event of provider.streamChat([], [createTool()], { model: "deepseek-reasoner" })) {
      events.push(event);
    }

    expect(callCount).toBe(2);
    expect(events.some((event) => event.type === "tool-calls")).toBe(true);
    expect(events.find((event) => event.type === "text-delta")).toMatchObject({
      type: "text-delta",
      text: "Inspecting."
    });
  });
});

describe("modelSupportsToolCalls", () => {
  it("keeps app-level tools enabled for both built-in models", () => {
    expect(modelSupportsToolCalls("deepseek-reasoner")).toBe(true);
    expect(modelSupportsToolCalls("DeepSeek-Reasoner")).toBe(true);
    expect(modelSupportsToolCalls("deepseek-chat")).toBe(true);
  });
});

describe("isReasonerModel", () => {
  it("detects reasoner variants", () => {
    expect(isReasonerModel("deepseek-reasoner")).toBe(true);
    expect(isReasonerModel("DeepSeek-Reasoner")).toBe(true);
    expect(isReasonerModel("deepseek-chat")).toBe(false);
  });
});
