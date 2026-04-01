export type MessageRole = "system" | "user" | "assistant" | "tool";

export type ToolCall = {
  id: string;
  name: string;
  input: unknown;
};

export type ConversationMessage = {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string;
  toolCallId?: string;
  toolCalls?: ToolCall[];
};

export type TokenUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

export type ModelEvent =
  | { type: "text-delta"; text: string }
  | { type: "tool-calls"; calls: ToolCall[] }
  | { type: "response-complete"; usage?: TokenUsage };

export type Session = {
  id: string;
  workspaceRoot: string;
  model: string;
  createdAt: string;
  updatedAt: string;
  messages: ConversationMessage[];
};

export type HistoryEntry = {
  sessionId: string;
  workspaceRoot: string;
  prompt: string;
  model: string;
  createdAt: string;
};

export type ModelOptions = {
  model: string;
  temperature?: number;
};

export type ConfigSources = {
  apiKey: "override" | "env" | "config" | "default";
  baseUrl: "override" | "env" | "config" | "default";
  model: "override" | "env" | "config" | "default";
};

export type StoredConfig = {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
};

export type RuntimeOverrides = {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
};

export type ResolvedConfig = {
  apiKey?: string;
  baseUrl: string;
  model: string;
  sources: ConfigSources;
};
