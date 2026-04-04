import React from "react";
import { Box, Text } from "ink";
import type { OverlayState } from "../types.js";
import { selectOverlayDescriptor } from "../overlaySelectors.js";
import { THEME } from "../theme.js";

function overlayColor(mode: NonNullable<OverlayState>["mode"]): string {
  switch (mode) {
    case "confirm":
      return THEME.borderWarning;
    case "diff":
      return THEME.brand;
    default:
      return THEME.border;
  }
}

export function OverlayRenderer({
  overlay
}: {
  overlay: OverlayState;
}): React.ReactNode {
  const descriptor = selectOverlayDescriptor(overlay);
  if (!descriptor) {
    return null;
  }

  return (
    <Box
      flexDirection="column"
      marginTop={1}
      marginBottom={1}
      borderStyle="round"
      borderColor={overlayColor(overlay.mode)}
      paddingX={1}
    >
      <Text color={overlayColor(overlay.mode)}>{descriptor.title}</Text>
      <Box flexDirection="column" marginTop={1}>
        {descriptor.body.split("\n").map((line, index) => (
          <Text key={`${index}:${line}`} color={THEME.text}>
            {line || " "}
          </Text>
        ))}
      </Box>
      <Text color={THEME.dim}>{descriptor.hint}</Text>
    </Box>
  );
}
