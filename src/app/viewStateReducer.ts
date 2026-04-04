import type { RecentDiffPreview, SessionSummary } from "../core/types.js";
import type { AppModeState, ConfirmationRequest, OverlayState } from "./types.js";

export type ViewStateAction =
  | { type: "open-resume"; query: string; matches: SessionSummary[]; message?: string }
  | { type: "open-diff"; preview: RecentDiffPreview }
  | {
      type: "open-permissions";
      workspaceRoot: string;
      workspaceRules: string[];
      sessionRules: string[];
    }
  | { type: "open-confirm"; confirmation: ConfirmationRequest }
  | { type: "close-overlay" };

function deriveViewMode(overlay: OverlayState): AppModeState["viewMode"] {
  if (!overlay) {
    return "chat";
  }

  return overlay.mode;
}

export function createInitialViewState(): AppModeState {
  return {
    viewMode: "chat",
    overlay: null
  };
}

export function viewStateReducer(
  _state: AppModeState,
  action: ViewStateAction
): AppModeState {
  switch (action.type) {
    case "open-resume": {
      const overlay: OverlayState = {
        mode: "resume",
        query: action.query,
        matches: action.matches,
        message: action.message
      };
      return {
        viewMode: deriveViewMode(overlay),
        overlay
      };
    }
    case "open-diff": {
      const overlay: OverlayState = {
        mode: "diff",
        preview: action.preview
      };
      return {
        viewMode: deriveViewMode(overlay),
        overlay
      };
    }
    case "open-permissions": {
      const overlay: OverlayState = {
        mode: "permissions",
        workspaceRoot: action.workspaceRoot,
        workspaceRules: action.workspaceRules,
        sessionRules: action.sessionRules
      };
      return {
        viewMode: deriveViewMode(overlay),
        overlay
      };
    }
    case "open-confirm": {
      const overlay: OverlayState = {
        mode: "confirm",
        confirmation: action.confirmation
      };
      return {
        viewMode: deriveViewMode(overlay),
        overlay
      };
    }
    case "close-overlay":
      return createInitialViewState();
  }
}
