import React from "react";
import { Box, Text } from "ink";

export function OverlayPane({
  title,
  body,
  hint
}: {
  title: string;
  body: string;
  hint?: string;
}): React.ReactNode {
  return (
    <Box
      borderStyle="round"
      borderColor="yellow"
      paddingX={1}
      flexDirection="column"
      marginTop={1}
    >
      <Text color="yellowBright">{title}</Text>
      <Text>{body}</Text>
      {hint ? <Text color="gray">{hint}</Text> : null}
    </Box>
  );
}
