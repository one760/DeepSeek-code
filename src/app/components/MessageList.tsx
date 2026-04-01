import React from "react";
import { Box, Text } from "ink";
import type { DisplayMessage, DisplayRole, DisplayTone } from "../types.js";

function roleColor(role: DisplayRole): "cyan" | "green" | "magenta" | "yellow" {
  switch (role) {
    case "user":
      return "green";
    case "assistant":
      return "magenta";
    case "tool":
      return "yellow";
    default:
      return "cyan";
  }
}

function roleBorder(role: DisplayRole): "cyan" | "green" | "magenta" | "yellow" {
  return roleColor(role);
}

function toneColor(tone: DisplayTone | undefined): "white" | "green" | "yellow" | "red" {
  switch (tone) {
    case "success":
      return "green";
    case "warning":
      return "yellow";
    case "error":
      return "red";
    default:
      return "white";
  }
}

function roleLabel(role: DisplayRole): string {
  switch (role) {
    case "user":
      return "You";
    case "assistant":
      return "DeepSeek";
    case "tool":
      return "Tool";
    default:
      return "System";
  }
}

function clampMessagePreview(message: DisplayMessage): string {
  const maxLines = message.role === "tool" ? 4 : 8;
  const maxChars = message.role === "tool" ? 320 : 1200;
  const normalized = message.content.trimEnd();

  if (!normalized) {
    return "";
  }

  const lines = normalized.split(/\r?\n/);
  const visibleLines = lines.slice(0, maxLines);
  let preview = visibleLines.join("\n");

  if (preview.length > maxChars) {
    preview = `${preview.slice(0, maxChars)}...`;
  }

  if (lines.length > maxLines || normalized.length > preview.length) {
    preview = `${preview}\n[truncated]`;
  }

  return preview;
}

export function MessageList({
  messages,
  windowSize,
  scrollOffset
}: {
  messages: DisplayMessage[];
  windowSize: number;
  scrollOffset: number;
}): React.ReactNode {
  const safeWindowSize = Math.max(1, windowSize);
  const clampedOffset = Math.max(0, Math.min(scrollOffset, Math.max(0, messages.length - safeWindowSize)));
  const startIndex = Math.max(0, messages.length - safeWindowSize - clampedOffset);
  const visibleMessages = messages.slice(startIndex, startIndex + safeWindowSize);

  return (
    <Box
      borderStyle="round"
      borderColor="yellow"
      paddingX={1}
      flexDirection="column"
      flexGrow={1}
    >
      {visibleMessages.length === 0 ? (
        <Text color="gray">No messages yet.</Text>
      ) : (
        visibleMessages.map((message) => (
          <Box
            key={message.id}
            flexDirection="column"
            borderStyle="single"
            borderColor={roleBorder(message.role)}
            paddingX={1}
            marginBottom={1}
          >
            <Text color={roleColor(message.role)}>
              {roleLabel(message.role)}
            </Text>
            <Text color={toneColor(message.tone)}>{clampMessagePreview(message)}</Text>
          </Box>
        ))
      )}
    </Box>
  );
}
