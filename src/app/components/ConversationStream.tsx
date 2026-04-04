import React, { useMemo } from "react";
import { Box, Text } from "ink";
import type { DisplayMessage } from "../types.js";
import { THEME, roleColor, roleLabel, rolePrefix } from "../theme.js";

function clampMessagePreview(message: DisplayMessage): string {
  const maxLines = message.role === "tool-summary" ? 6 : message.role === "assistant" ? 15 : 12;
  const maxChars = message.role === "tool-summary" ? 500 : message.role === "assistant" ? 2000 : 1600;
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

function renderContent(content: string, color?: string, dimColor = false): React.ReactNode {
  if (!content) {
    return null;
  }

  return content.split("\n").map((line, index) => (
    <Text key={`${index}:${line}`} color={color} dimColor={dimColor}>
      {line || " "}
    </Text>
  ));
}

export function ConversationStream({
  messages,
  windowSize,
  scrollOffset,
  showWelcomeLine
}: {
  messages: DisplayMessage[];
  windowSize: number;
  scrollOffset: number;
  showWelcomeLine: boolean;
}): React.ReactNode {
  const visibleMessages = useMemo(() => {
    const safeWindowSize = Math.max(1, windowSize);
    const clampedOffset = Math.max(
      0,
      Math.min(scrollOffset, Math.max(0, messages.length - safeWindowSize))
    );
    const startIndex = Math.max(0, messages.length - safeWindowSize - clampedOffset);

    return messages.slice(startIndex, startIndex + safeWindowSize);
  }, [messages, scrollOffset, windowSize]);

  return (
    <Box flexDirection="column" flexGrow={1}>
      {showWelcomeLine ? (
        <Text color={THEME.dim}>Welcome back. Start typing or use / for actions.</Text>
      ) : null}
      {!showWelcomeLine && visibleMessages.length === 0 ? (
        <Text color={THEME.dim}>No messages yet.</Text>
      ) : (
        visibleMessages.map((message) => {
          const preview = clampMessagePreview(message);
          const accent = roleColor(message.role);
          const label = roleLabel(message.role);
          const prefix = rolePrefix(message.role);
          const toolLabel = message.toolName ?? label;
          const successMark =
            typeof message.success === "boolean" ? (message.success ? "✓" : "✗") : "";

          if (message.role === "system-muted" || message.role === "thinking-summary") {
            return (
              <Box key={message.id} flexDirection="column" marginBottom={1}>
                {renderContent(`${prefix} ${preview}`, THEME.dim)}
              </Box>
            );
          }

          if (message.role === "tool-summary") {
            return (
              <Box key={message.id} flexDirection="column" marginBottom={1}>
                <Text color={accent}>
                  {`${prefix} ${toolLabel}${successMark ? `  ${successMark}` : ""}`}
                </Text>
                {renderContent(preview, THEME.dim)}
              </Box>
            );
          }

          return (
            <Box key={message.id} flexDirection="column" marginBottom={1}>
              <Text color={accent}>{`${prefix} ${label}`}</Text>
              {renderContent(preview, THEME.text)}
            </Box>
          );
        })
      )}
    </Box>
  );
}
