import type {
  PendingActionDecision,
  Session,
  SessionSummary
} from "../core/types.js";
import { modelSupportsToolCalls } from "../provider/deepseek/DeepSeekProvider.js";
import type { DisplayMessage, DisplayTone, OverlayState } from "./types.js";

export function truncate(text: string, maxLength = 500): string {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength)}\n...`;
}

export function systemMessage(
  content: string,
  tone: DisplayTone = "neutral"
): DisplayMessage {
  return {
    id: crypto.randomUUID(),
    role: "system-muted",
    content,
    tone
  };
}

export function toDisplayMessages(
  session: Session,
  trailing?: DisplayMessage
): DisplayMessage[] {
  const mapped = session.messages.map((message) => {
    const role =
      message.role === "tool"
        ? "tool-summary"
        : message.role === "system"
          ? "system-muted"
          : message.role;

    return {
      id: message.id,
      role,
      content: message.content,
      toolName: message.role === "tool" ? "tool" : undefined
    };
  }) as DisplayMessage[];

  if (trailing) {
    mapped.push(trailing);
  }

  return mapped;
}

export function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("zh-CN", {
    hour12: false,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function formatResumeMatches(
  query: string,
  matches: SessionSummary[],
  message?: string
): string {
  const header = query ? `Query: ${query}` : "Recent sessions";
  const body = matches
    .slice(0, 20)
    .map((session, index) => {
      return [
        `${index + 1}. ${session.title}`,
        `   workspace: ${session.workspaceRoot}`,
        `   last: ${formatTimestamp(session.lastActiveAt)} | messages: ${session.messageCount}`
      ].join("\n");
    })
    .join("\n");

  return [header, message, body].filter(Boolean).join("\n\n");
}

export function formatPermissionsContent(params: {
  workspaceRoot: string;
  workspaceRules: string[];
  sessionRules: string[];
}): string {
  const { workspaceRoot, workspaceRules, sessionRules } = params;

  return [
    `Workspace: ${workspaceRoot}`,
    "",
    "Workspace rules:",
    workspaceRules.length > 0
      ? workspaceRules.map((rule) => `- ${rule}`).join("\n")
      : "- none",
    "",
    "Session rules:",
    sessionRules.length > 0
      ? sessionRules.map((rule) => `- ${rule}`).join("\n")
      : "- none",
    "",
    "Commands: clear-session | clear-workspace | close"
  ].join("\n");
}

export function overlayPromptLabel(overlay: OverlayState): string {
  switch (overlay?.mode) {
    case "resume":
      return "resume";
    case "diff":
      return "diff";
    case "permissions":
      return "permissions";
    case "confirm":
      return "confirm";
    default:
      return "prompt";
  }
}

export function overlayFooter(overlay: OverlayState): string {
  switch (overlay?.mode) {
    case "resume":
      return "Type a number to resume, more text to filter, Esc to close.";
    case "diff":
      return "Press Enter or type close to dismiss. Esc also closes.";
    case "permissions":
      return "Use clear-session, clear-workspace, close, or Esc.";
    case "confirm":
      return "Allowed decisions: once | session | always | deny. Esc cancels the prompt.";
    default:
      return "Commands: /help /model /clear /status /tools /resume /diff /permissions /quit | Scroll: Up/Down j/k PgUp/PgDn Home/End";
  }
}

export function parseDecision(
  input: string,
  allowedDecisions: PendingActionDecision[]
): PendingActionDecision | null {
  const normalized = input.toLowerCase();
  const aliases: Record<string, PendingActionDecision> = {
    y: "once",
    yes: "once",
    once: "once",
    s: "session",
    session: "session",
    a: "always",
    always: "always",
    n: "deny",
    no: "deny",
    deny: "deny"
  };
  const mapped = aliases[normalized];
  if (!mapped) {
    return null;
  }

  return allowedDecisions.includes(mapped) ? mapped : null;
}

export function formatModelCapabilityNotice(model: string): string {
  if (!modelSupportsToolCalls(model)) {
    return `${model} may not support every tool flow. Native tool calls can still fail at runtime.`;
  }

  if (model.toLowerCase().includes("reasoner")) {
    return `${model} uses adaptive tools. The app will try native tool calling first and fall back when the API rejects it.`;
  }

  return `${model} supports tool calling. File reads, edits, shell, and git tools stay available.`;
}
