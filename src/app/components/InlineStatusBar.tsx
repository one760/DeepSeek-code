import path from "node:path";
import React from "react";
import { Box, Text } from "ink";
import { THEME } from "../theme.js";

export function InlineStatusBar({
  workspaceRoot,
  sessionId,
  model,
  busy,
  tokenUsageSummary
}: {
  workspaceRoot: string;
  sessionId: string;
  model: string;
  busy: boolean;
  tokenUsageSummary: string;
}): React.ReactNode {
  const workspaceName = path.basename(workspaceRoot) || workspaceRoot;
  const modeLabel = model.toLowerCase().includes("reasoner")
    ? "adaptive-tools"
    : "native-tools";

  return (
    <Box
      borderStyle="round"
      borderColor={THEME.border}
      paddingX={1}
      marginBottom={1}
      flexDirection="column"
    >
      <Box justifyContent="space-between">
        <Box>
          <Text color={THEME.brand} bold>
            deepseek code
          </Text>
          <Text color={THEME.dim}>   </Text>
          <Text color={THEME.text}>{workspaceName}</Text>
          <Text color={THEME.dim}>   </Text>
          <Text color={THEME.assistant}>{model}</Text>
          <Text color={THEME.dim}>   </Text>
          <Text color={THEME.dim}>{modeLabel}</Text>
        </Box>
        <Text color={busy ? THEME.tool : THEME.success}>
          {busy ? "● thinking" : "● ready"}
        </Text>
      </Box>
      <Box justifyContent="space-between">
        <Text color={THEME.dim}>
          {tokenUsageSummary ? `${tokenUsageSummary} · ` : ""}
          session {sessionId.slice(0, 8)}
        </Text>
        <Text color={THEME.dim}>{busy ? "streaming" : "idle"}</Text>
      </Box>
    </Box>
  );
}
