import OpenAI from "openai";
import type {
  ChatCompletionAssistantMessageParam,
  ChatCompletionChunk,
  ChatCompletionMessageParam,
  ChatCompletionToolMessageParam
} from "openai/resources/chat/completions";
import type {
  ApiConversationMessage,
  ModelEvent,
  ResolvedConfig,
  TokenUsage,
  ToolCall
} from "../../core/types.js";
import type { ToolDefinition } from "../../tools/types.js";
import {
  buildToolDescriptionBlock,
  convertToolResultsForPrompt,
  injectToolSystemPrompt,
  parseToolCallsFromText
} from "./promptToolCalling.js";
import { withRetry } from "./retry.js";

export type ModelProvider = {
  streamChat: (
    messages: ApiConversationMessage[],
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
  stream_options?: {
    include_usage?: boolean;
  };
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
      stream_options: params.stream_options,
      stream: true
    });
}

export function isReasonerModel(model: string): boolean {
  return model.toLowerCase().includes("reasoner");
}

export function modelSupportsToolCalls(model: string): boolean {
  return model.trim().length > 0;
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

function mapAssistantMessage(message: ApiConversationMessage): ChatCompletionAssistantMessageParam {
  const mapped: ChatCompletionAssistantMessageParam & {
    reasoning_content?: string;
  } = {
    role: "assistant",
    content: message.content || null
  };

  if (message.reasoningContent) {
    mapped.reasoning_content = message.reasoningContent;
  }

  if (message.toolCalls?.length) {
    mapped.tool_calls = message.toolCalls.map((toolCall) => ({
      id: toolCall.id,
      type: "function" as const,
      function: {
        name: toolCall.name,
        arguments: JSON.stringify(toolCall.input)
      }
    }));
  }

  return mapped;
}

function toChatMessages(
  messages: ApiConversationMessage[],
  options?: {
    includeToolMessages?: boolean;
  }
): ChatCompletionMessageParam[] {
  const mapped: ChatCompletionMessageParam[] = [];

  for (const message of messages) {
    if (message.role === "assistant") {
      mapped.push(mapAssistantMessage(message));
      continue;
    }

    if (message.role === "tool") {
      if (options?.includeToolMessages === false) {
        continue;
      }

      mapped.push({
        role: "tool",
        content: message.content,
        tool_call_id: message.toolCallId ?? ""
      } satisfies ChatCompletionToolMessageParam);
      continue;
    }

    mapped.push({
      role: message.role === "system" ? "system" : "user",
      content: message.content
    });
  }

  return mapped;
}

function stringifyError(error: unknown): string {
  const candidate = error as { message?: string; status?: number };
  if (candidate?.status) {
    return `${candidate.status}: ${candidate.message ?? "Request failed"}`;
  }

  return candidate?.message ?? String(error);
}

function shouldFallbackToPromptToolCalling(error: unknown): boolean {
  const message = stringifyError(error).toLowerCase();

  return [
    "reasoning_content",
    "tool_calls",
    "function calling",
    "tool messages",
    "tool role",
    "tool_calls is not supported",
    "does not support",
    "invalid parameter"
  ].some((fragment) => message.includes(fragment));
}

async function* iterateChunks(params: {
  streamFactory: StreamFactory;
  request: Parameters<StreamFactory>[0];
}): AsyncIterable<
  | { type: "retry"; event: { attempt: number; error: string; delayMs: number } }
  | { type: "chunk"; chunk: ChatCompletionChunk }
> {
  const { streamFactory, request } = params;
  const retryEvents: Array<{ attempt: number; error: string; delayMs: number }> = [];
  const opened = await withRetry(
    async () => {
      const stream = await streamFactory(request);
      const iterator = stream[Symbol.asyncIterator]();
      const firstChunk = await iterator.next();
      return {
        iterator,
        firstChunk
      };
    },
    undefined,
    ({ attempt, error, delayMs }) => {
      retryEvents.push({
        attempt,
        error: stringifyError(error),
        delayMs
      });
    }
  );

  for (const retryEvent of retryEvents) {
    yield {
      type: "retry",
      event: retryEvent
    };
  }

  if (!opened.firstChunk.done) {
    yield {
      type: "chunk",
      chunk: opened.firstChunk.value
    };
  }

  while (true) {
    const next = await opened.iterator.next();
    if (next.done) {
      break;
    }

    yield {
      type: "chunk",
      chunk: next.value
    };
  }
}

export class DeepSeekProvider implements ModelProvider {
  private readonly streamFactory: StreamFactory;
  private readonly defaultModel: string;

  constructor(config: ResolvedConfig, streamFactory = createOpenAIStreamFactory(config)) {
    this.streamFactory = streamFactory;
    this.defaultModel = config.model;
  }

  private async *streamWithNativeTools(
    messages: ApiConversationMessage[],
    tools: ToolDefinition<unknown>[],
    model: string
  ): AsyncIterable<ModelEvent> {
    const request = {
      model,
      messages: toChatMessages(messages),
      tools: tools.length > 0 ? mapToolDefinitions(tools) : undefined,
      stream_options: {
        include_usage: true
      }
    };
    const toolCallBuffer = new Map<
      number,
      { id: string; name: string; arguments: string }
    >();
    let usage: TokenUsage | undefined;
    let reasoningContent = "";

    for await (const item of iterateChunks({
      streamFactory: this.streamFactory,
      request
    })) {
      if (item.type === "retry") {
        yield {
          type: "retry",
          attempt: item.event.attempt,
          error: item.event.error,
          delayMs: item.event.delayMs
        };
        continue;
      }

      const { chunk } = item;
      if (chunk.usage) {
        usage = {
          inputTokens: chunk.usage.prompt_tokens,
          outputTokens: chunk.usage.completion_tokens,
          totalTokens: chunk.usage.total_tokens
        };
      }

      const choice = chunk.choices[0];
      const delta = (choice?.delta ?? {}) as ChatCompletionChunk.Choice.Delta & {
        reasoning_content?: string;
      };

      if (delta.content) {
        yield {
          type: "text-delta",
          text: delta.content
        };
      }

      if (delta.reasoning_content) {
        reasoningContent += delta.reasoning_content;
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
      type: "response-complete",
      usage,
      reasoningContent: reasoningContent || undefined,
      toolStrategy: "native"
    };
  }

  private async *streamWithPromptFallback(
    messages: ApiConversationMessage[],
    tools: ToolDefinition<unknown>[],
    model: string
  ): AsyncIterable<ModelEvent> {
    const toolBlock = buildToolDescriptionBlock(tools);
    const promptMessages = injectToolSystemPrompt(
      convertToolResultsForPrompt(messages),
      toolBlock
    );
    const request = {
      model,
      messages: toChatMessages(promptMessages, { includeToolMessages: false }),
      stream_options: {
        include_usage: true
      }
    };
    let bufferedText = "";
    let usage: TokenUsage | undefined;

    for await (const item of iterateChunks({
      streamFactory: this.streamFactory,
      request
    })) {
      if (item.type === "retry") {
        yield {
          type: "retry",
          attempt: item.event.attempt,
          error: item.event.error,
          delayMs: item.event.delayMs
        };
        continue;
      }

      const { chunk } = item;
      if (chunk.usage) {
        usage = {
          inputTokens: chunk.usage.prompt_tokens,
          outputTokens: chunk.usage.completion_tokens,
          totalTokens: chunk.usage.total_tokens
        };
      }

      const choice = chunk.choices[0];
      const delta = choice?.delta;
      if (delta?.content) {
        bufferedText += delta.content;
      }
    }

    const parsed = parseToolCallsFromText(bufferedText);
    if (parsed.cleanText) {
      yield {
        type: "text-delta",
        text: parsed.cleanText
      };
    }

    if (parsed.toolCalls.length > 0) {
      yield {
        type: "tool-calls",
        calls: parsed.toolCalls
      };
    }

    yield {
      type: "response-complete",
      usage,
      toolStrategy: "prompt-fallback"
    };
  }
  async *streamChat(
    messages: ApiConversationMessage[],
    tools: ToolDefinition<unknown>[],
    options?: { model?: string }
  ): AsyncIterable<ModelEvent> {
    const model = options?.model ?? this.defaultModel;

    if (tools.length === 0) {
      for await (const event of this.streamWithNativeTools(messages, tools, model)) {
        yield event;
      }
      return;
    }

    if (!isReasonerModel(model)) {
      for await (const event of this.streamWithNativeTools(messages, tools, model)) {
        yield event;
      }
      return;
    }

    try {
      for await (const event of this.streamWithNativeTools(messages, tools, model)) {
        yield event;
      }
    } catch (error) {
      if (!shouldFallbackToPromptToolCalling(error)) {
        throw error;
      }

      for await (const event of this.streamWithPromptFallback(messages, tools, model)) {
        yield event;
      }
    }
  }
}
