import { describe, expect, it } from "vitest";
import { shouldTruncate, truncateConversation } from "../src/core/contextManager.js";
import type { ApiConversationMessage } from "../src/core/types.js";

function createMessage(
  id: string,
  role: ApiConversationMessage["role"],
  content: string,
  extras: Partial<ApiConversationMessage> = {}
): ApiConversationMessage {
  return {
    id,
    role,
    content,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...extras
  };
}

describe("context manager", () => {
  it("keeps system and paired tool chains together when truncating", () => {
    const repeated = "x".repeat(180_000);
    const messages = [
      createMessage("system", "system", "system"),
      createMessage("user-1", "user", "first user"),
      createMessage("assistant-1", "assistant", repeated, {
        toolCalls: [{ id: "tool-1", name: "read_file", input: { path: "a.ts" } }]
      }),
      createMessage("tool-1", "tool", repeated, { toolCallId: "tool-1" }),
      createMessage("user-2", "user", repeated),
      createMessage("assistant-2", "assistant", "latest answer")
    ];

    const result = truncateConversation({
      messages,
      model: "custom-model",
      reserveTokens: 1000
    });

    expect(result.truncated).toBe(true);
    expect(result.messages[0]?.role).toBe("system");
    expect(result.messages.some((message) => message.id === "tool-1")).toBe(
      result.messages.some((message) => message.id === "assistant-1")
    );
    expect(result.messages.at(-1)?.id).toBe("assistant-2");
  });

  it("detects when the conversation exceeds the truncation threshold", () => {
    const messages = [
      createMessage("1", "user", "x".repeat(500_000))
    ];

    expect(shouldTruncate(messages, "deepseek-chat")).toBe(true);
  });
});
