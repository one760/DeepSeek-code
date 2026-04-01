import React from "react";
import { Box, Text } from "ink";
import type { TraceItem, TraceTone } from "../types.js";

function toneColor(tone: TraceTone | undefined): "gray" | "green" | "yellow" | "red" {
  switch (tone) {
    case "success":
      return "green";
    case "warning":
      return "yellow";
    case "error":
      return "red";
    default:
      return "gray";
  }
}

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "--:--";
  }

  return date.toLocaleTimeString("zh-CN", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

export function TracePanel({
  items,
  busy
}: {
  items: TraceItem[];
  busy: boolean;
}): React.ReactNode {
  const visible = items.slice(-4).reverse();

  return (
    <Box
      borderStyle="round"
      borderColor={busy ? "yellow" : "gray"}
      paddingX={1}
      flexDirection="column"
      marginTop={1}
    >
      <Box justifyContent="space-between">
        <Text color={busy ? "yellowBright" : "gray"}>Visible reasoning trace</Text>
        <Text color="gray">{busy ? "live" : "idle"}</Text>
      </Box>
      {visible.length === 0 ? (
        <Text color="gray">No trace yet. This panel shows visible progress, tools, and summaries, not hidden raw chain-of-thought.</Text>
      ) : (
        visible.map((item) => (
          <Box key={item.id} justifyContent="space-between">
            <Text color={toneColor(item.tone)}>
              {item.label}
              {item.detail ? ` · ${item.detail}` : ""}
            </Text>
            <Text color="gray">{formatTime(item.createdAt)}</Text>
          </Box>
        ))
      )}
    </Box>
  );
}
