import { randomUUID } from "node:crypto";
import type { ConversationMessage, Session } from "./types.js";
import { appendHistoryLine, saveSession } from "../services/storage.js";
import type { DeepSeekProvider } from "../provider/deepseek/DeepSeekProvider.js";
import { executeToolCalls, type ConfirmationHandler, type ToolRunEvent } from "../tools/executor.js";
import type { ToolDefinition } from "../tools/types.js";

export type ConversationCallbacks = {
  onAssistantMessageCreated?: (messageId: string) => void;
  onAssistantDelta?: (messageId: string, delta: string, fullText: string) => void;
  onToolEvent?: (event: ToolRunEvent) => void;
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

export async function runConversationTurn(params: {
  session: Session;
  prompt: string;
  provider: DeepSeekProvider;
  tools: ToolDefinition<unknown>[];
  confirm: ConfirmationHandler;
  callbacks?: ConversationCallbacks;
}): Promise<Session> {
  const { session, prompt, provider, tools, confirm, callbacks } = params;
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

  while (true) {
    let assistantText = "";
    let assistantToolCalls: ConversationMessage["toolCalls"] = [];
    const assistantMessageId = randomUUID();
    callbacks?.onAssistantMessageCreated?.(assistantMessageId);

    for await (const event of provider.streamChat(session.messages, tools, {
      model: session.model
    })) {
      if (event.type === "text-delta") {
        assistantText += event.text;
        callbacks?.onAssistantDelta?.(assistantMessageId, event.text, assistantText);
      }

      if (event.type === "tool-calls") {
        assistantToolCalls = event.calls;
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
    session.updatedAt = nowIso();
    await saveSession(session);

    if (!assistantToolCalls || assistantToolCalls.length === 0) {
      break;
    }

    const toolResults = await executeToolCalls(
      assistantToolCalls,
      toolMap,
      { workspaceRoot: session.workspaceRoot },
      confirm,
      callbacks?.onToolEvent
    );

    for (const result of toolResults) {
      session.messages.push({
        id: randomUUID(),
        role: "tool",
        content: result.output,
        createdAt: nowIso(),
        toolCallId: result.toolCallId
      });
    }

    session.updatedAt = nowIso();
    await saveSession(session);
  }

  return session;
}
