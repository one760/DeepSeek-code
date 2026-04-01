import React from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";

export function PromptBar({
  input,
  busy,
  promptLabel,
  footer,
  onChange,
  onSubmit
}: {
  input: string;
  busy: boolean;
  promptLabel: string;
  footer: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
}): React.ReactNode {
  const confirmationActive = promptLabel === "confirm";

  return (
    <Box
      borderStyle="round"
      borderColor={confirmationActive ? "yellow" : "gray"}
      paddingX={1}
      flexDirection="column"
      marginTop={1}
    >
      <Box justifyContent="space-between">
        <Text color="gray">
          {confirmationActive ? "Decision required" : "Prompt"}
        </Text>
        <Text color="gray">{busy && !confirmationActive ? "live" : "idle"}</Text>
      </Box>
      <Box>
        <Text color={confirmationActive ? "yellowBright" : "greenBright"}>
          {promptLabel}&gt;{" "}
        </Text>
        <TextInput value={input} onChange={onChange} onSubmit={onSubmit} />
      </Box>
      <Text color="gray">{footer}</Text>
      {busy && !confirmationActive ? (
        <Text color="yellowBright">Model request in progress...</Text>
      ) : null}
    </Box>
  );
}
