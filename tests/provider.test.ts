import { describe, expect, it } from "vitest";
import type { ChatCompletionChunk } from "openai/resources/chat/completions";
import { DeepSeekProvider, modelSupportsToolCalls } from "../src/provider/deepseek/DeepSeekProvider.js";
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

  it("omits tool definitions for reasoner models", async () => {
    let observedTools: unknown;
    const provider = new DeepSeekProvider(config, async (params) => {
      observedTools = params.tools;
      return emptyStream();
    });

    for await (const _event of provider.streamChat([], [createTool()], { model: "deepseek-reasoner" })) {
      // consume stream
    }

    expect(observedTools).toBeUndefined();
  });
});

describe("modelSupportsToolCalls", () => {
  it("disables tool calling for reasoner variants", () => {
    expect(modelSupportsToolCalls("deepseek-reasoner")).toBe(false);
    expect(modelSupportsToolCalls("DeepSeek-Reasoner")).toBe(false);
    expect(modelSupportsToolCalls("deepseek-chat")).toBe(true);
  });
});
