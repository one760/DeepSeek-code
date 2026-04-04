export type DisplayRole =
  | "assistant"
  | "user"
  | "system-muted"
  | "tool-summary"
  | "thinking-summary";

export type DisplayTone = "neutral" | "success" | "warning" | "error";

export type DisplayMessage = {
  id: string;
  role: DisplayRole;
  content: string;
  tone?: DisplayTone;
  toolName?: string;
  success?: boolean;
};

export type TraceTone = "neutral" | "success" | "warning" | "error";

export type TraceItem = {
  id: string;
  label: string;
  detail?: string;
  createdAt: string;
  tone?: TraceTone;
  status?: "pending" | "running" | "done" | "error";
};

import type {
  AppViewMode,
  PendingActionDecision,
  RecentDiffPreview,
  SessionSummary
} from "../core/types.js";
import type { PendingAction } from "../tools/types.js";

export type ConfirmationRequest = {
  request: PendingAction;
  resolve: (decision: PendingActionDecision) => void;
};

export type OverlayState =
  | { mode: "resume"; query: string; matches: SessionSummary[]; message?: string }
  | { mode: "diff"; preview: RecentDiffPreview }
  | {
      mode: "permissions";
      workspaceRoot: string;
      workspaceRules: string[];
      sessionRules: string[];
    }
  | { mode: "confirm"; confirmation: ConfirmationRequest }
  | null;

export type InputMode = "text" | "command";

export type CommandPaletteAction =
  | { type: "command"; command: "help" | "status" | "usage" | "tools" | "diff" | "clear" | "quit" }
  | { type: "submenu"; submenu: "model" | "permissions" | "resume" }
  | { type: "model"; model: string }
  | { type: "permission"; operation: "show" | "clear-session" | "clear-workspace" }
  | { type: "resume"; sessionId: string };

export type CommandPaletteOption = {
  id: string;
  label: string;
  description?: string;
  disabled?: boolean;
  action: CommandPaletteAction;
};

export type AppModeState = {
  viewMode: AppViewMode;
  overlay: OverlayState;
};
