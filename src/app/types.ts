export type DisplayRole = "system" | "user" | "assistant" | "tool";

export type DisplayTone = "neutral" | "success" | "warning" | "error";

export type DisplayMessage = {
  id: string;
  role: DisplayRole;
  content: string;
  tone?: DisplayTone;
};

export type TraceTone = "neutral" | "success" | "warning" | "error";

export type TraceItem = {
  id: string;
  label: string;
  detail?: string;
  createdAt: string;
  tone?: TraceTone;
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
  | { mode: "permissions"; content: string }
  | { mode: "confirm"; confirmation: ConfirmationRequest }
  | null;

export type AppModeState = {
  viewMode: AppViewMode;
  overlay: OverlayState;
};
