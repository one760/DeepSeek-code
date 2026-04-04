import { formatPermissionsContent, formatResumeMatches } from "./formatters.js";
import type { OverlayState } from "./types.js";

export type OverlayDescriptor = {
  title: string;
  body: string;
  hint: string;
};

export function selectOverlayDescriptor(overlay: OverlayState): OverlayDescriptor | null {
  if (!overlay) {
    return null;
  }

  switch (overlay.mode) {
    case "confirm":
      return {
        title: `Confirm ${overlay.confirmation.request.toolName}`,
        body: [
          overlay.confirmation.request.message,
          overlay.confirmation.request.preview?.preview
        ]
          .filter(Boolean)
          .join("\n\n"),
        hint: `Allowed: ${overlay.confirmation.request.allowedDecisions.join(" | ")}`
      };
    case "resume":
      return {
        title: "Resume Session",
        body: formatResumeMatches(overlay.query, overlay.matches, overlay.message),
        hint: "Type a number, filter text, or close."
      };
    case "diff":
      return {
        title: `Latest Diff · ${overlay.preview.targetLabel}`,
        body: overlay.preview.preview,
        hint: overlay.preview.truncated
          ? "Preview truncated. Press enter to close."
          : "Press enter to close."
      };
    case "permissions":
      return {
        title: "Permissions",
        body: formatPermissionsContent({
          workspaceRoot: overlay.workspaceRoot,
          workspaceRules: overlay.workspaceRules,
          sessionRules: overlay.sessionRules
        }),
        hint: "Use clear-session, clear-workspace, or close."
      };
  }
}
