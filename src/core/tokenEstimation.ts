import type { ConversationMessage } from "./types.js";

const CJK_PATTERN = /[\u3400-\u4DBF\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]/u;

export function estimateTokens(text: string): number {
  if (!text) {
    return 0;
  }

  let asciiChars = 0;
  let cjkChars = 0;
  let otherChars = 0;

  for (const char of text) {
    if (char.charCodeAt(0) <= 0x7f) {
      asciiChars += 1;
      continue;
    }

    if (CJK_PATTERN.test(char)) {
      cjkChars += 1;
      continue;
    }

    otherChars += 1;
  }

  return Math.max(
    1,
    Math.ceil(asciiChars / 4) + Math.ceil(cjkChars / 2) + Math.ceil(otherChars / 3)
  );
}

export function estimateMessageTokens(message: ConversationMessage): number {
  const contentTokens = estimateTokens(message.content);
  const toolCallTokens = (message.toolCalls ?? []).reduce((total, toolCall) => {
    return total + estimateTokens(JSON.stringify(toolCall));
  }, 0);

  return contentTokens + toolCallTokens + 8;
}

export function estimateConversationTokens(
  messages: ConversationMessage[]
): number {
  return messages.reduce((total, message) => total + estimateMessageTokens(message), 0);
}

export function getModelContextLimit(model: string): number {
  const normalized = model.trim().toLowerCase();
  if (
    normalized === "deepseek-chat" ||
    normalized === "deepseek-reasoner"
  ) {
    return 128_000;
  }

  return 64_000;
}
