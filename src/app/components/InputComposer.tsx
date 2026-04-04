import React, { useEffect, useState } from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import { THEME } from "../theme.js";

export function InputComposer({
  input,
  busy,
  onChange,
  onSubmit
}: {
  input: string;
  busy: boolean;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
}): React.ReactNode {
  const [spinnerIndex, setSpinnerIndex] = useState(0);

  useEffect(() => {
    if (!busy) {
      setSpinnerIndex(0);
      return;
    }

    const timer = setInterval(() => {
      setSpinnerIndex((current) => (current + 1) % THEME.spinner.length);
    }, 120);

    return () => {
      clearInterval(timer);
    };
  }, [busy]);

  return (
    <Box
      flexDirection="column"
      marginTop={1}
      borderStyle="round"
      borderColor={busy ? THEME.borderActive : THEME.border}
      paddingX={1}
    >
      <Box>
        <Text color={THEME.brand}>› </Text>
        <TextInput
          value={input}
          onChange={onChange}
          onSubmit={onSubmit}
          placeholder="Type a message..."
        />
      </Box>
      <Text color={THEME.dim}>
        {busy
          ? `${THEME.spinner[spinnerIndex]} Streaming... · / for commands · Ctrl+T thinking`
          : "/ for commands · ↑↓ scroll · Ctrl+T thinking"}
      </Text>
    </Box>
  );
}
