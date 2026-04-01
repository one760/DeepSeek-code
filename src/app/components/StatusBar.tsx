import path from "node:path";
import React from "react";
import { Box, Text } from "ink";
import { APP_VERSION } from "../../meta.js";

export function StatusBar({
  workspaceRoot,
  model,
  busy,
  messageCount,
  scrollOffset,
  sessionId,
  workspaceRuleCount = 0,
  sessionRuleCount = 0
}: {
  workspaceRoot: string;
  model: string;
  busy: boolean;
  messageCount: number;
  scrollOffset: number;
  sessionId: string;
  workspaceRuleCount?: number;
  sessionRuleCount?: number;
}): React.ReactNode {
  const workspaceName = path.basename(workspaceRoot) || workspaceRoot;
  const shortSessionId = sessionId.slice(0, 8);

  return (
    <Box
      borderStyle="round"
      borderColor="cyan"
      paddingX={1}
      flexDirection="column"
    >
      <Box justifyContent="space-between">
        <Text color="yellowBright">deepseek code v{APP_VERSION}</Text>
        <Text color={busy ? "yellowBright" : "greenBright"}>
          {busy ? "thinking" : "ready"}
        </Text>
      </Box>
      <Box justifyContent="space-between">
        <Text color="whiteBright">workspace {workspaceName}</Text>
        <Text color="magentaBright">model {model}</Text>
      </Box>
      <Box justifyContent="space-between">
        <Text color="gray">
          session {shortSessionId} | messages {messageCount}
        </Text>
        <Text color="gray">
          rules w:{workspaceRuleCount} s:{sessionRuleCount} | offset {scrollOffset}
        </Text>
      </Box>
    </Box>
  );
}
