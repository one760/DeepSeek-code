import type { SessionSummary } from "../core/types.js";
import { getRootCommandPaletteOptions } from "./commandRegistry.js";
import { BUILTIN_MODELS } from "./modelSelection.js";
import type { CommandPaletteOption, InputMode } from "./types.js";

type CommandPaletteState = {
  inputMode: InputMode;
  title: string;
  options: CommandPaletteOption[];
};

const ROOT_COMMANDS: CommandPaletteOption[] = getRootCommandPaletteOptions();

function fuzzyIncludes(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

function filterRootCommands(query: string): CommandPaletteOption[] {
  const normalized = query.trim().replace(/^\//, "");
  if (!normalized) {
    return ROOT_COMMANDS;
  }

  return ROOT_COMMANDS.filter((option) =>
    [option.label, option.description ?? ""].some((candidate) =>
      fuzzyIncludes(candidate, normalized)
    )
  );
}

function buildModelOptions(currentModel: string): CommandPaletteOption[] {
  return BUILTIN_MODELS.map((model) => ({
    id: model,
    label: model,
    description:
      model === currentModel
        ? "Current model"
        : model.includes("reasoner")
          ? "Adaptive reasoning model with tool fallback"
          : "Tool-enabled chat model",
    action: { type: "model", model }
  }));
}

function buildPermissionOptions(): CommandPaletteOption[] {
  return [
    {
      id: "permissions-show",
      label: "show",
      description: "View current workspace and session rules",
      action: { type: "permission", operation: "show" }
    },
    {
      id: "permissions-clear-session",
      label: "clear-session",
      description: "Clear session-only permission rules",
      action: { type: "permission", operation: "clear-session" }
    },
    {
      id: "permissions-clear-workspace",
      label: "clear-workspace",
      description: "Clear persisted workspace permission rules",
      action: { type: "permission", operation: "clear-workspace" }
    }
  ];
}

function buildResumeOptions(recentSessions: SessionSummary[]): CommandPaletteOption[] {
  if (recentSessions.length === 0) {
    return [
      {
        id: "resume-empty",
        label: "No recent sessions",
        description: "Start a few conversations first",
        disabled: true,
        action: { type: "submenu", submenu: "resume" }
      }
    ];
  }

  return recentSessions.slice(0, 8).map((session) => ({
    id: session.id,
    label: session.title,
    description: session.workspaceRoot,
    action: { type: "resume", sessionId: session.id }
  }));
}

export function buildCommandPalette(params: {
  input: string;
  currentModel: string;
  recentSessions: SessionSummary[];
}): CommandPaletteState {
  const { input, currentModel, recentSessions } = params;
  const trimmed = input.trim();

  if (!trimmed.startsWith("/")) {
    return {
      inputMode: "text",
      title: "",
      options: []
    };
  }

  if (trimmed === "/model") {
    return {
      inputMode: "command",
      title: "Switch Model",
      options: buildModelOptions(currentModel)
    };
  }

  if (trimmed === "/permissions") {
    return {
      inputMode: "command",
      title: "Permissions",
      options: buildPermissionOptions()
    };
  }

  if (trimmed === "/resume") {
    return {
      inputMode: "command",
      title: "Resume Session",
      options: buildResumeOptions(recentSessions)
    };
  }

  return {
    inputMode: "command",
    title: "Command Palette",
    options: filterRootCommands(trimmed)
  };
}
