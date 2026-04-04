import type { DisplayRole } from "./types.js";

export const THEME = {
  brand: "#62c7ff",
  border: "#444444",
  borderActive: "#62c7ff",
  borderWarning: "#e8a838",
  user: "#6ee7b7",
  assistant: "#c4b5fd",
  tool: "#fbbf24",
  system: "#62c7ff",
  error: "#f87171",
  success: "#6ee7b7",
  dim: "gray",
  text: "white",
  spinner: ["◐", "◓", "◑", "◒"],
} as const;

export function roleColor(role: DisplayRole): string {
  switch (role) {
    case "user":
      return THEME.user;
    case "assistant":
      return THEME.assistant;
    case "tool-summary":
      return THEME.tool;
    case "system-muted":
      return THEME.system;
    case "thinking-summary":
      return THEME.dim;
    default:
      return THEME.dim;
  }
}

export function roleBorderColor(role: DisplayRole): string {
  switch (role) {
    case "user":
      return THEME.user;
    case "assistant":
      return THEME.assistant;
    case "tool-summary":
      return THEME.tool;
    case "system-muted":
    case "thinking-summary":
    default:
      return THEME.border;
  }
}

export function roleLabel(role: DisplayRole): string {
  switch (role) {
    case "user":
      return "You";
    case "assistant":
      return "DeepSeek";
    case "tool-summary":
      return "Tool";
    case "system-muted":
      return "System";
    case "thinking-summary":
      return "Thinking";
    default:
      return "";
  }
}

export function rolePrefix(role: DisplayRole): string {
  switch (role) {
    case "user":
      return "›";
    case "assistant":
      return "◆";
    case "tool-summary":
      return "$";
    case "system-muted":
      return "·";
    case "thinking-summary":
      return "∴";
    default:
      return "";
  }
}

export function toneColor(tone: string | undefined): string {
  switch (tone) {
    case "success":
      return THEME.success;
    case "warning":
      return THEME.tool;
    case "error":
      return THEME.error;
    default:
      return THEME.dim;
  }
}

export function toneSymbol(tone: string | undefined): string {
  switch (tone) {
    case "success":
      return "✓";
    case "warning":
      return "●";
    case "error":
      return "✗";
    default:
      return "●";
  }
}
