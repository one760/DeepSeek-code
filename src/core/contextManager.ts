import type { ApiConversationMessage } from "./types.js";
import {
  estimateConversationTokens,
  estimateMessageTokens,
  getModelContextLimit
} from "./tokenEstimation.js";

export type TruncateConversationParams = {
  messages: ApiConversationMessage[];
  model: string;
  reserveTokens?: number;
};

export type TruncateConversationResult = {
  messages: ApiConversationMessage[];
  originalCount: number;
  truncatedCount: number;
  estimatedTokens: number;
  truncated: boolean;
};

type MessageBlock = {
  messages: ApiConversationMessage[];
  estimatedTokens: number;
};

function createBlocks(messages: ApiConversationMessage[]): MessageBlock[] {
  const blocks: MessageBlock[] = [];

  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    if (!message) {
      continue;
    }

    if (message.role === "assistant" && message.toolCalls?.length) {
      const blockMessages = [message];
      let cursor = index + 1;

      while (cursor < messages.length && messages[cursor]?.role === "tool") {
        blockMessages.push(messages[cursor]!);
        cursor += 1;
      }

      blocks.push({
        messages: blockMessages,
        estimatedTokens: estimateConversationTokens(blockMessages)
      });
      index = cursor - 1;
      continue;
    }

    blocks.push({
      messages: [message],
      estimatedTokens: estimateMessageTokens(message)
    });
  }

  return blocks;
}

export function shouldTruncate(
  messages: ApiConversationMessage[],
  model: string
): boolean {
  return estimateConversationTokens(messages) > getModelContextLimit(model) * 0.8;
}

export function truncateConversation(
  params: TruncateConversationParams
): TruncateConversationResult {
  const { messages, model, reserveTokens = 8_000 } = params;
  const originalCount = messages.length;
  const originalTokens = estimateConversationTokens(messages);
  const limit = Math.max(1, getModelContextLimit(model) - reserveTokens);

  if (originalTokens <= limit) {
    return {
      messages,
      originalCount,
      truncatedCount: originalCount,
      estimatedTokens: originalTokens,
      truncated: false
    };
  }

  const systemMessage = messages.find((message) => message.role === "system");
  const nonSystemMessages = messages.filter((message) => message.role !== "system");
  const firstUser = nonSystemMessages.find((message) => message.role === "user");
  const blocks = createBlocks(nonSystemMessages);
  const retainedBlocks: MessageBlock[] = [];
  const retainedSet = new Set<ApiConversationMessage>();
  let tokenCount = systemMessage ? estimateMessageTokens(systemMessage) : 0;

  for (let index = blocks.length - 1; index >= 0; index -= 1) {
    const block = blocks[index];
    if (!block) {
      continue;
    }

    if (retainedBlocks.length === 0 || tokenCount + block.estimatedTokens <= limit) {
      retainedBlocks.unshift(block);
      tokenCount += block.estimatedTokens;
      for (const message of block.messages) {
        retainedSet.add(message);
      }
    }
  }

  if (firstUser && !retainedSet.has(firstUser)) {
    const firstUserTokens = estimateMessageTokens(firstUser);
    if (tokenCount + firstUserTokens <= limit) {
      retainedBlocks.unshift({
        messages: [firstUser],
        estimatedTokens: firstUserTokens
      });
      retainedSet.add(firstUser);
      tokenCount += firstUserTokens;
    }
  }

  const truncatedMessages = [
    ...(systemMessage ? [systemMessage] : []),
    ...retainedBlocks.flatMap((block) => block.messages)
  ];
  const estimatedTokens = estimateConversationTokens(truncatedMessages);

  return {
    messages: truncatedMessages,
    originalCount,
    truncatedCount: truncatedMessages.length,
    estimatedTokens,
    truncated: truncatedMessages.length < originalCount
  };
}
