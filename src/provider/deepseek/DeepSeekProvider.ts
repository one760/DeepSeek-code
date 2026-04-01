import OpenAI from "openai";
import type {
  ChatCompletionAssistantMessageParam,
  ChatCompletionChunk,
  ChatCompletionMessageParam,
  ChatCompletionToolMessageParam
} from "openai/resources/chat/completions";
import type {
  ConversationMessage,
  ModelEvent,
  ResolvedConfig,
  ToolCall
} from "../../core/types.js";
import type { ToolDefinition } from "../../tools/types.js";

export type ModelProvider = {
  streamChat: (
    messages: ConversationMessage[],
    tools: ToolDefinition<unknown>[],
    options?: { model?: string }
  ) => AsyncIterable<ModelEvent>;
};

type StreamFactory = (params: {
  model: string;
  messages: ChatCompletionMessageParam[];
  tools?: Array<{
    type: "function";
    function: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
  }>;
}) => Promise<AsyncIterable<ChatCompletionChunk>>;

function createOpenAIStreamFactory(config: ResolvedConfig): StreamFactory {
  if (!config.apiKey) {
    throw new Error("Missing DeepSeek API key. Run `deepseek code login` first.");
  }

  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl
  });

  return async (params) =>
    client.chat.completions.create({
      model: params.model,
      messages: params.messages,
      ...(params.tools?.length ? { tools: params.tools } : {}),
      stream: true
    });
}

export function modelSupportsToolCalls(model: string): boolean {
  return !model.toLowerCase().includes("reasoner");
}

function mapToolDefinitions(tools: ToolDefinition<unknown>[]) {
  return tools.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema
    }
  }));
}

function safeParseToolArguments(serialized: string): unknown {
  try {
    return JSON.parse(serialized);
  } catch {
    return {
      raw: serialized
    };
  }
}

function mapAssistantMessage(message: ConversationMessage): ChatCompletionAssistantMessageParam {
  return {
    role: "assistant",
    content: message.content || null,
    ...(message.toolCalls?.length
      ? {
          tool_calls: message.toolCalls.map((toolCall) => ({
            id: toolCall.id,
            type: "function" as const,
            function: {
              name: toolCall.name,
              arguments: JSON.stringify(toolCall.input)
            }
          }))
        }
      : {})
  };
}

function toChatMessages(messages: ConversationMessage[]): ChatCompletionMessageParam[] {
  return messages.map((message) => {
    if (message.role === "assistant") {
      return mapAssistantMessage(message);
    }

    if (message.role === "tool") {
      return {
        role: "tool",
        content: message.content,
        tool_call_id: message.toolCallId ?? ""
      } satisfies ChatCompletionToolMessageParam;
    }

    return {
      role: message.role === "system" ? "system" : "user",
      content: message.content
    };
  });
}

export class DeepSeekProvider implements ModelProvider {
  private readonly streamFactory: StreamFactory;
  private readonly defaultModel: string;

  constructor(config: ResolvedConfig, streamFactory = createOpenAIStreamFactory(config)) {
    this.streamFactory = streamFactory;
    this.defaultModel = config.model;
  }

  async *streamChat(
    messages: ConversationMessage[],
    tools: ToolDefinition<unknown>[],
    options?: { model?: string }
  ): AsyncIterable<ModelEvent> {
    const model = options?.model ?? this.defaultModel;
    const requestTools = modelSupportsToolCalls(model)
      ? mapToolDefinitions(tools)
      : undefined;
    const chunks = await this.streamFactory({
      model,
      messages: toChatMessages(messages),
      tools: requestTools
    });
    const toolCallBuffer = new Map<
      number,
      { id: string; name: string; arguments: string }
    >();

    for await (const chunk of chunks) {
      const choice = chunk.choices[0];
      const delta = choice?.delta;
      if (!delta) {
        continue;
      }

      if (delta.content) {
        yield {
          type: "text-delta",
          text: delta.content
        };
      }

      if (delta.tool_calls) {
        for (const toolCallDelta of delta.tool_calls) {
          const index = toolCallDelta.index ?? 0;
          const current = toolCallBuffer.get(index) ?? {
            id: toolCallDelta.id ?? `tool-${index}`,
            name: "",
            arguments: ""
          };

          toolCallBuffer.set(index, {
            id: toolCallDelta.id ?? current.id,
            name: toolCallDelta.function?.name ?? current.name,
            arguments: `${current.arguments}${toolCallDelta.function?.arguments ?? ""}`
          });
        }
      }
    }

    if (toolCallBuffer.size > 0) {
      const calls: ToolCall[] = Array.from(toolCallBuffer.values()).map((toolCall) => ({
        id: toolCall.id,
        name: toolCall.name,
        input: safeParseToolArguments(toolCall.arguments)
      }));

      yield {
        type: "tool-calls",
        calls
      };
    }

    yield {
      type: "response-complete"
    };
  }
}
