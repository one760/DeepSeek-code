export type MessageRole = "system" | "user" | "assistant" | "tool";
export type AppViewMode = "chat" | "resume" | "diff" | "permissions" | "confirm";
export type ToolStrategy = "native" | "prompt-fallback";

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

export type ApiConversationMessage = ConversationMessage & {
  reasoningContent?: string;
};

export type TokenUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

export type SessionTokenUsage = {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  turnCount: number;
};

export type ModelEvent =
  | { type: "text-delta"; text: string }
  | { type: "tool-calls"; calls: ToolCall[] }
  | { type: "retry"; attempt: number; error: string; delayMs: number }
  | {
      type: "response-complete";
      usage?: TokenUsage;
      reasoningContent?: string;
      toolStrategy?: ToolStrategy;
    };

export type Session = {
  id: string;
  workspaceRoot: string;
  model: string;
  createdAt: string;
  updatedAt: string;
  lastActiveAt: string;
  title: string;
  lastPrompt: string;
  messageCount: number;
  messages: ConversationMessage[];
  tokenUsage?: SessionTokenUsage;
};

export type SessionSummary = {
  id: string;
  workspaceRoot: string;
  model: string;
  createdAt: string;
  updatedAt: string;
  lastActiveAt: string;
  title: string;
  lastPrompt: string;
  messageCount: number;
};

export type ResumeQueryResult =
  | { type: "none"; query: string; matches: SessionSummary[] }
  | { type: "single"; query: string; matches: [SessionSummary] }
  | { type: "multiple"; query: string; matches: SessionSummary[] };

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

export type PermissionScope = "session" | "workspace";

export type PendingActionDecision = "once" | "session" | "always" | "deny";

export type PermissionRule = {
  toolName: string;
  scope: PermissionScope;
  createdAt: string;
};

export type RecentDiffPreview = {
  sessionId: string;
  toolName: string;
  targetLabel: string;
  preview: string;
  createdAt: string;
  truncated: boolean;
};
