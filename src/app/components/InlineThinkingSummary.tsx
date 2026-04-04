import React from "react";
import { Box, Text } from "ink";
import type { TraceItem } from "../types.js";
import { THEME, toneColor, toneSymbol } from "../theme.js";

export function InlineThinkingSummary({
  items,
  expanded,
  busy
}: {
  items: TraceItem[];
  expanded: boolean;
  busy: boolean;
}): React.ReactNode {
  if (items.length === 0) {
    return null;
  }

  const latest = items[items.length - 1];
  const recentItems = items.slice(-5).reverse();

  return (
    <Box flexDirection="column" marginTop={1} marginBottom={1}>
      <Text color={THEME.dim}>
        ∴ {latest?.label}
        {items.length > 0 ? ` · ${items.length} events` : ""}
        {" · Ctrl+T"}
      </Text>
      {expanded ? (
        <Box
          flexDirection="column"
          marginTop={1}
          borderStyle="round"
          borderColor={busy ? THEME.brand : THEME.border}
          paddingX={1}
        >
          <Text color={THEME.text}>Thinking</Text>
          {recentItems.map((item) => (
            <Text key={item.id} color={toneColor(item.tone)}>
              {toneSymbol(item.tone)} {item.label}
              {item.detail ? ` · ${item.detail}` : ""}
            </Text>
          ))}
        </Box>
      ) : null}
    </Box>
  );
}
