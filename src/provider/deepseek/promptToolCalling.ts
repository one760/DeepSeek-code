import type { ApiConversationMessage, ToolCall } from "../../core/types.js";
import type { ToolDefinition } from "../../tools/types.js";

function serializeToolCall(toolCall: ToolCall): string {
  return [
    "<tool_call>",
    `<name>${toolCall.name}</name>`,
    `<arguments>${JSON.stringify(toolCall.input)}</arguments>`,
    "</tool_call>"
  ].join("\n");
}

export function buildToolDescriptionBlock(
  tools: ToolDefinition<unknown>[]
): string {
  const renderedTools = tools
    .map((tool) =>
      [
        "<tool>",
        `<name>${tool.name}</name>`,
        `<description>${tool.description}</description>`,
        `<input_schema>${JSON.stringify(tool.inputSchema)}</input_schema>`,
        "</tool>"
      ].join("\n")
    )
    .join("\n");

  return [
    "Tool calling fallback instructions:",
    "When a tool is needed, respond with one or more XML blocks in this exact shape:",
    "<tool_call>",
    "<name>tool_name</name>",
    "<arguments>{\"json\":\"object\"}</arguments>",
    "</tool_call>",
    "You may include normal assistant text outside the XML blocks.",
    "Available tools:",
    renderedTools
  ].join("\n");
}

function decodeToolCallXml(block: string): ToolCall | null {
  const name = block.match(/<name>([\s\S]*?)<\/name>/i)?.[1]?.trim();
  const argumentsText = block.match(/<arguments>([\s\S]*?)<\/arguments>/i)?.[1]?.trim();

  if (!name) {
    return null;
  }

  let input: unknown = {};
  if (argumentsText) {
    try {
      input = JSON.parse(argumentsText);
    } catch {
      input = { raw: argumentsText };
    }
  }

  return {
    id: `prompt-tool-${name}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    input
  };
}

export function parseToolCallsFromText(text: string): {
  cleanText: string;
  toolCalls: ToolCall[];
} {
  const toolCalls: ToolCall[] = [];
  const cleanText = text.replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, (block) => {
    const parsed = decodeToolCallXml(block);
    if (parsed) {
      toolCalls.push(parsed);
    }
    return "";
  });

  return {
    cleanText: cleanText.trim(),
    toolCalls
  };
}

export function injectToolSystemPrompt(
  messages: ApiConversationMessage[],
  toolBlock: string
): ApiConversationMessage[] {
  const systemIndex = messages.findIndex((message) => message.role === "system");

  if (systemIndex >= 0) {
    return messages.map((message, index) =>
      index === systemIndex
        ? {
            ...message,
            content: `${message.content.trim()}\n\n${toolBlock}`.trim()
          }
        : message
    );
  }

  return [
    {
      id: "prompt-tool-system",
      role: "system",
      content: toolBlock,
      createdAt: new Date().toISOString()
    },
    ...messages
  ];
}

export function convertToolResultsForPrompt(
  messages: ApiConversationMessage[]
): ApiConversationMessage[] {
  const toolCallNames = new Map<string, string>();

  for (const message of messages) {
    if (message.role !== "assistant" || !message.toolCalls?.length) {
      continue;
    }

    for (const toolCall of message.toolCalls) {
      toolCallNames.set(toolCall.id, toolCall.name);
    }
  }

  return messages.map((message) => {
    if (message.role === "assistant" && message.toolCalls?.length) {
      const blocks = message.toolCalls.map(serializeToolCall).join("\n");
      return {
        ...message,
        content: [message.content.trim(), blocks].filter(Boolean).join("\n\n")
      };
    }

    if (message.role === "tool") {
      const toolName = message.toolCallId
        ? toolCallNames.get(message.toolCallId) ?? "unknown"
        : "unknown";

      return {
        ...message,
        role: "user",
        content: [
          "Tool result:",
          "<tool_result>",
          `<tool_call_id>${message.toolCallId ?? ""}</tool_call_id>`,
          `<name>${toolName}</name>`,
          `<output>${message.content}</output>`,
          "</tool_result>"
        ].join("\n")
      };
    }

    return message;
  });
}
