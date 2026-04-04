import React from "react";
import { Box, Text } from "ink";
import type { CommandPaletteOption } from "../types.js";
import { THEME } from "../theme.js";

export function CommandPaletteInline({
  title,
  options,
  selectedIndex
}: {
  title: string;
  options: CommandPaletteOption[];
  selectedIndex: number;
}): React.ReactNode {
  if (options.length === 0) {
    return (
      <Box
        flexDirection="column"
        marginTop={1}
        borderStyle="round"
        borderColor={THEME.border}
        paddingX={1}
      >
        <Text color={THEME.brand}>{title}</Text>
        <Text color={THEME.dim}>No matching commands</Text>
        <Text color={THEME.dim}>Esc to close</Text>
      </Box>
    );
  }

  return (
    <Box
      flexDirection="column"
      marginTop={1}
      borderStyle="round"
      borderColor={THEME.border}
      paddingX={1}
    >
      <Text color={THEME.brand}>{title}</Text>
      {options.map((option, index) => {
        const selected = index === selectedIndex;
        return (
          <Box key={option.id} justifyContent="space-between">
            <Text
              color={selected ? THEME.brand : THEME.text}
              inverse={selected}
              dimColor={!selected && option.disabled}
            >
              {option.label}
            </Text>
            <Text color={THEME.dim}>{option.description ?? ""}</Text>
          </Box>
        );
      })}
      <Text color={THEME.dim}>Esc to close</Text>
    </Box>
  );
}
