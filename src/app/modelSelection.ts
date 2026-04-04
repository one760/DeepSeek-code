export const BUILTIN_MODELS = ["deepseek-chat", "deepseek-reasoner"] as const;

const MODEL_ALIASES: Record<string, string> = {
  chat: "deepseek-chat",
  "deepseek-chat": "deepseek-chat",
  reasoner: "deepseek-reasoner",
  reasoning: "deepseek-reasoner",
  "deepseek-reasoner": "deepseek-reasoner"
};

export function resolveModelSelection(input: string): string {
  const normalized = input.trim().toLowerCase();
  return MODEL_ALIASES[normalized] ?? input.trim();
}

export function formatModelHelp(currentModel: string): string {
  return [
    `Current model: ${currentModel}`,
    "Switch with `/model <name>`.",
    `Built-ins: ${BUILTIN_MODELS.join(", ")}`,
    "Aliases: chat, reasoner",
    "Capabilities: deepseek-chat supports native tools; deepseek-reasoner uses adaptive tools with fallback.",
    "Custom model names are also supported."
  ].join("\n");
}
