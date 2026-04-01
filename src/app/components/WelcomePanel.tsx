import path from "node:path";
import React from "react";
import { Box, Text } from "ink";
import type { SessionSummary } from "../../core/types.js";

function formatRelativeActivity(value: string): string {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) {
    return value;
  }

  const diffMinutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
  if (diffMinutes < 1) {
    return "just now";
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
}

function shortenPath(value: string, maxLength = 36): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `...${value.slice(-(maxLength - 3))}`;
}

export function WelcomePanel({
  workspaceRoot,
  model,
  recentSessions
}: {
  workspaceRoot: string;
  model: string;
  recentSessions: SessionSummary[];
}): React.ReactNode {
  const workspaceName = path.basename(workspaceRoot) || workspaceRoot;
  const recentActivity = recentSessions.slice(0, 4);

  return (
    <Box
      borderStyle="round"
      borderColor="yellow"
      paddingX={1}
      paddingY={0}
      flexDirection="row"
      marginBottom={1}
    >
      <Box flexDirection="column" flexGrow={1} width="46%" paddingRight={2}>
        <Text color="yellowBright">deepseek code</Text>
        <Text color="whiteBright">Welcome back.</Text>
        <Text color="gray">{shortenPath(workspaceRoot)}</Text>
        <Text> </Text>
        <Text color="yellow">
          {"  .-..-.  "}
        </Text>
        <Text color="yellow">
          {" ( o  o ) "}
        </Text>
        <Text color="yellow">
          {" |  --  | "}
        </Text>
        <Text color="yellow">
          {" '------' "}
        </Text>
        <Text> </Text>
        <Text color="gray">{model} · API key login</Text>
        <Text color="gray">workspace · {workspaceName}</Text>
      </Box>
      <Box flexDirection="column" width={1}>
        <Text color="yellow">│</Text>
      </Box>
      <Box flexDirection="column" flexGrow={1} paddingLeft={2}>
        <Text color="yellowBright">Tips for getting started</Text>
        <Text color="white">Run `/help` to see commands and `/resume` for prior sessions</Text>
        <Text color="white">Use `/diff` after file edits and `/permissions` to inspect rules</Text>
        <Text> </Text>
        <Text color="yellowBright">Recent activity</Text>
        {recentActivity.length === 0 ? (
          <Text color="gray">No recent activity</Text>
        ) : (
          recentActivity.map((session) => (
            <Box key={session.id} flexDirection="column" marginBottom={1}>
              <Text color="white">{session.title}</Text>
              <Text color="gray">
                {path.basename(session.workspaceRoot) || session.workspaceRoot} · {formatRelativeActivity(session.lastActiveAt)}
              </Text>
            </Box>
          ))
        )}
      </Box>
    </Box>
  );
}
