import { randomUUID } from "node:crypto";
import type {
  ApiConversationMessage,
  ConversationMessage,
  Session,
  TokenUsage
} from "./types.js";
import { appendHistoryLine, saveSession } from "../services/storage.js";
import type { DeepSeekProvider } from "../provider/deepseek/DeepSeekProvider.js";
import { executeToolCalls, type ConfirmationHandler, type ToolRunEvent } from "../tools/executor.js";
import type { ToolDefinition } from "../tools/types.js";
import type { SystemPromptContext } from "./systemPrompt.js";
import { createSystemMessage } from "./systemPrompt.js";
import { truncateConversation } from "./contextManager.js";

export type ConversationCallbacks = {
  onAssistantMessageCreated?: (messageId: string) => void;
  onAssistantDelta?: (messageId: string, delta: string, fullText: string) => void;
  onToolEvent?: (event: ToolRunEvent) => void;
  onContextTruncated?: (
    originalCount: number,
    truncatedCount: number,
    estimatedTokens: number
  ) => void;
  onRetry?: (attempt: number, error: string, delayMs: number) => void;
};

function nowIso(): string {
  return new Date().toISOString();
}

function createMessage(role: ConversationMessage["role"], content: string): ConversationMessage {
  return {
    id: randomUUID(),
    role,
    content,
    createdAt: nowIso()
  };
}

function toApiMessage(message: ConversationMessage): ApiConversationMessage {
  return {
    ...message
  };
}

function mergeTokenUsage(
  session: Session,
  usage: TokenUsage | undefined
): void {
  session.tokenUsage ??= {
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalTokens: 0,
    turnCount: 0
  };
  session.tokenUsage.turnCount += 1;

  if (!usage) {
    return;
  }

  session.tokenUsage.totalInputTokens += usage.inputTokens ?? 0;
  session.tokenUsage.totalOutputTokens += usage.outputTokens ?? 0;
  session.tokenUsage.totalTokens += usage.totalTokens ?? 0;
}

export async function runConversationTurn(params: {
  session: Session;
  prompt: string;
  provider: DeepSeekProvider;
  tools: ToolDefinition<unknown>[];
  confirm: ConfirmationHandler;
  sessionAllowedTools?: Set<string>;
  systemPromptContext?: SystemPromptContext;
  callbacks?: ConversationCallbacks;
}): Promise<Session> {
  const {
    session,
    prompt,
    provider,
    tools,
    confirm,
    callbacks,
    sessionAllowedTools,
    systemPromptContext
  } = params;
  const toolMap = new Map(tools.map((tool) => [tool.name, tool]));
  const userMessage = createMessage("user", prompt);
  session.messages.push(userMessage);
  session.updatedAt = nowIso();
  await saveSession(session);
  await appendHistoryLine({
    sessionId: session.id,
    workspaceRoot: session.workspaceRoot,
    prompt,
    model: session.model,
    createdAt: userMessage.createdAt
  });
  let apiMessages: ApiConversationMessage[] = [
    ...(systemPromptContext ? [createSystemMessage(systemPromptContext)] : []),
    ...session.messages.map(toApiMessage)
  ];

  while (true) {
    const requestSnapshot = truncateConversation({
      messages: apiMessages,
      model: session.model
    });
    if (requestSnapshot.truncated) {
      callbacks?.onContextTruncated?.(
        requestSnapshot.originalCount,
        requestSnapshot.truncatedCount,
        requestSnapshot.estimatedTokens
      );
    }

    let assistantText = "";
    let assistantToolCalls: ConversationMessage["toolCalls"] = [];
    let assistantReasoningContent = "";
    let responseUsage: TokenUsage | undefined;
    const assistantMessageId = randomUUID();
    callbacks?.onAssistantMessageCreated?.(assistantMessageId);

    for await (const event of provider.streamChat(requestSnapshot.messages, tools, {
      model: session.model
    })) {
      if (event.type === "text-delta") {
        assistantText += event.text;
        callbacks?.onAssistantDelta?.(assistantMessageId, event.text, assistantText);
      }

      if (event.type === "tool-calls") {
        assistantToolCalls = event.calls;
      }

      if (event.type === "retry") {
        callbacks?.onRetry?.(event.attempt, event.error, event.delayMs);
      }

      if (event.type === "response-complete") {
        assistantReasoningContent = event.reasoningContent ?? "";
        responseUsage = event.usage;
      }
    }

    const assistantMessage: ConversationMessage = {
      id: assistantMessageId,
      role: "assistant",
      content: assistantText,
      createdAt: nowIso(),
      toolCalls: assistantToolCalls
    };
    session.messages.push(assistantMessage);
    apiMessages.push({
      ...assistantMessage,
      reasoningContent: assistantReasoningContent || undefined
    });
    mergeTokenUsage(session, responseUsage);
    session.updatedAt = nowIso();
    await saveSession(session);

    if (!assistantToolCalls || assistantToolCalls.length === 0) {
      break;
    }

    const toolResults = await executeToolCalls(
      assistantToolCalls,
      toolMap,
      {
        workspaceRoot: session.workspaceRoot,
        sessionId: session.id,
        sessionAllowedTools
      },
      confirm,
      callbacks?.onToolEvent
    );

    for (const result of toolResults) {
      const toolMessage: ConversationMessage = {
        id: randomUUID(),
        role: "tool",
        content: result.output,
        createdAt: nowIso(),
        toolCallId: result.toolCallId
      };
      session.messages.push(toolMessage);
      apiMessages.push(toApiMessage(toolMessage));
    }

    session.updatedAt = nowIso();
    await saveSession(session);
  }

  return session;
}
