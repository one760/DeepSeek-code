import path from "node:path";
import React, { useEffect, useRef, useState } from "react";
import { useApp, useInput, useStdout } from "ink";
import type {
  PendingActionDecision,
  RecentDiffPreview,
  Session,
  SessionSummary
} from "../core/types.js";
import { runConversationTurn } from "../core/runConversationTurn.js";
import { DeepSeekProvider } from "../provider/deepseek/DeepSeekProvider.js";
import { resolveConfig } from "../services/config.js";
import {
  clearSessionPermissionRules,
  clearWorkspacePermissionRules,
  createSessionPermissionState,
  getSessionPermissionRules,
  loadWorkspacePermissionRules
} from "../services/permissions.js";
import { resolveResumeQuery } from "../services/sessions.js";
import {
  loadRecentDiffPreview,
  loadSession,
  listSessionSummaries,
  saveSession
} from "../services/storage.js";
import { getToolDefinitions } from "../tools/registry.js";
import type { ToolRunEvent } from "../tools/executor.js";
import type { ConfirmationRequest, DisplayMessage, DisplayTone, OverlayState, TraceItem } from "./types.js";
import { formatModelHelp, resolveModelSelection } from "./modelSelection.js";
import { StatusBar } from "./components/StatusBar.js";
import { MessageList } from "./components/MessageList.js";
import { OverlayPane } from "./components/OverlayPane.js";
import { PromptBar } from "./components/PromptBar.js";
import { TracePanel } from "./components/TracePanel.js";
import { WelcomePanel } from "./components/WelcomePanel.js";

function truncate(text: string, maxLength = 500): string {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength)}\n...`;
}

function systemMessage(content: string, tone: DisplayTone = "neutral"): DisplayMessage {
  return {
    id: crypto.randomUUID(),
    role: "system",
    content,
    tone
  };
}

function toDisplayMessages(session: Session, trailing?: DisplayMessage): DisplayMessage[] {
  const mapped = session.messages.map((message) => ({
    id: message.id,
    role: message.role,
    content: message.content
  })) as DisplayMessage[];

  if (mapped.length === 0) {
    mapped.push(systemMessage("Deepseek Code ready. Use /help for commands."));
  }

  if (trailing) {
    mapped.push(trailing);
  }

  return mapped;
}

function formatTimestamp(value: string): string {
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

function formatResumeMatches(query: string, matches: SessionSummary[], message?: string): string {
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

function formatPermissionsContent(params: {
  workspaceRoot: string;
  workspaceRules: string[];
  sessionRules: string[];
}): string {
  const { workspaceRoot, workspaceRules, sessionRules } = params;

  return [
    `Workspace: ${workspaceRoot}`,
    "",
    "Workspace rules:",
    workspaceRules.length > 0 ? workspaceRules.map((rule) => `- ${rule}`).join("\n") : "- none",
    "",
    "Session rules:",
    sessionRules.length > 0 ? sessionRules.map((rule) => `- ${rule}`).join("\n") : "- none",
    "",
    "Commands: clear-session | clear-workspace | close"
  ].join("\n");
}

function overlayPromptLabel(overlay: OverlayState): string {
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

function overlayFooter(overlay: OverlayState): string {
  switch (overlay?.mode) {
    case "resume":
      return "Type a number to resume, more text to filter, or close to dismiss.";
    case "diff":
      return "Press enter or type close to dismiss the latest diff preview.";
    case "permissions":
      return "Use clear-session, clear-workspace, or close.";
    case "confirm":
      return "Allowed decisions: once | session | always | deny. yes=no longer enough for V2.";
    default:
      return "Commands: /help /model /clear /status /tools /resume /diff /permissions /quit | Scroll: PageUp/PageDown";
  }
}

function parseDecision(
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

export function DeepseekCodeApp({
  initialSession
}: {
  initialSession: Session;
}): React.ReactNode {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [displayMessages, setDisplayMessages] = useState<DisplayMessage[]>(
    toDisplayMessages(initialSession)
  );
  const [model, setModel] = useState(initialSession.model);
  const [overlay, setOverlay] = useState<OverlayState>(null);
  const [workspaceRuleCount, setWorkspaceRuleCount] = useState(0);
  const [sessionRuleCount, setSessionRuleCount] = useState(0);
  const [recentDiffPreview, setRecentDiffPreview] = useState<RecentDiffPreview | null>(null);
  const [recentSessions, setRecentSessions] = useState<SessionSummary[]>([]);
  const [traceItems, setTraceItems] = useState<TraceItem[]>([]);
  const sessionRef = useRef<Session>(initialSession);
  const toolsRef = useRef(getToolDefinitions());
  const sessionPermissionsRef = useRef(createSessionPermissionState());
  const scrollOffsetRef = useRef(0);
  const hasStreamedAssistantRef = useRef(false);

  useEffect(() => {
    scrollOffsetRef.current = scrollOffset;
  }, [scrollOffset]);

  async function refreshPermissionCounts(): Promise<void> {
    const workspaceRules = await loadWorkspacePermissionRules(sessionRef.current.workspaceRoot);
    const sessionRules = getSessionPermissionRules(sessionPermissionsRef.current);
    setWorkspaceRuleCount(workspaceRules.length);
    setSessionRuleCount(sessionRules.length);
  }

  async function refreshRecentSessions(): Promise<void> {
    const sessions = await listSessionSummaries();
    setRecentSessions(
      sessions.filter((session) => session.id !== sessionRef.current.id && session.messageCount > 0)
    );
  }

  useEffect(() => {
    void refreshPermissionCounts();
    void refreshRecentSessions();
  }, []);

  const overlayVisible = Boolean(overlay);
  const showWelcomePanel = sessionRef.current.messages.length === 0 && !overlayVisible;
  const messageWindowSize = Math.max(
    4,
    (stdout.rows ?? 24) - (overlayVisible ? 18 : 15)
  );

  useEffect(() => {
    setScrollOffset((current) =>
      Math.max(0, Math.min(current, Math.max(0, displayMessages.length - messageWindowSize)))
    );
  }, [displayMessages.length, messageWindowSize]);

  function maybeStickToBottom(): void {
    if (scrollOffsetRef.current === 0) {
      setScrollOffset(0);
    }
  }

  function appendDisplayMessage(message: DisplayMessage): void {
    setDisplayMessages((current) => [...current, message]);
    maybeStickToBottom();
  }

  function appendTrace(
    label: string,
    detail?: string,
    tone: TraceItem["tone"] = "neutral"
  ): void {
    setTraceItems((current) => {
      const next = [
        ...current,
        {
          id: crypto.randomUUID(),
          label,
          detail,
          tone,
          createdAt: new Date().toISOString()
        }
      ];

      return next.slice(-20);
    });
  }

  function upsertAssistantMessage(messageId: string, content: string): void {
    setDisplayMessages((current) => {
      const existingIndex = current.findIndex((message) => message.id === messageId);
      if (existingIndex >= 0) {
        return current.map((message) =>
          message.id === messageId ? { ...message, content } : message
        );
      }

      return [
        ...current,
        {
          id: messageId,
          role: "assistant",
          content
        }
      ];
    });
    maybeStickToBottom();
  }

  async function persistSession(): Promise<void> {
    sessionRef.current.updatedAt = new Date().toISOString();
    await saveSession(sessionRef.current);
    await refreshRecentSessions();
  }

  async function resumeSession(sessionSummary: SessionSummary): Promise<void> {
    const loaded = await loadSession(sessionSummary.id);
    if (!loaded) {
      appendDisplayMessage(systemMessage(`Session ${sessionSummary.id} was not found.`, "warning"));
      return;
    }

    sessionRef.current = loaded;
    sessionPermissionsRef.current = createSessionPermissionState();
    setModel(loaded.model);
    setDisplayMessages(
      toDisplayMessages(
        loaded,
        systemMessage(
          `Resumed ${loaded.title} from ${loaded.workspaceRoot} (${formatTimestamp(loaded.lastActiveAt)})`,
          "success"
        )
      )
    );
    setScrollOffset(0);
    setOverlay(null);
    setRecentDiffPreview(await loadRecentDiffPreview(loaded.id));
    appendTrace("Session resumed", loaded.title, "success");
    await refreshPermissionCounts();
    await refreshRecentSessions();
  }

  async function openResume(query = ""): Promise<void> {
    const result = await resolveResumeQuery(query);

    if (result.type === "single") {
      await resumeSession(result.matches[0]);
      return;
    }

    setOverlay({
      mode: "resume",
      query,
      matches: result.matches,
      message: result.type === "none" ? "No sessions matched this query." : undefined
    });
  }

  async function openDiff(): Promise<void> {
    const preview = recentDiffPreview ?? (await loadRecentDiffPreview(sessionRef.current.id));

    if (!preview) {
      appendDisplayMessage(systemMessage("No recent diff preview is available.", "warning"));
      return;
    }

    setRecentDiffPreview(preview);
    setOverlay({
      mode: "diff",
      preview
    });
  }

  async function openPermissions(): Promise<void> {
    const workspaceRules = await loadWorkspacePermissionRules(sessionRef.current.workspaceRoot);
    const sessionRules = getSessionPermissionRules(sessionPermissionsRef.current);

    setOverlay({
      mode: "permissions",
      content: formatPermissionsContent({
        workspaceRoot: sessionRef.current.workspaceRoot,
        workspaceRules: workspaceRules.map((rule) => rule.toolName),
        sessionRules: sessionRules.map((rule) => rule.toolName)
      })
    });
  }

  function handleToolEvent(event: ToolRunEvent): void {
    if (event.type === "tool-preview") {
      const preview: RecentDiffPreview = {
        sessionId: sessionRef.current.id,
        toolName: event.toolName,
        targetLabel: event.targetLabel,
        preview: event.preview,
        createdAt: new Date().toISOString(),
        truncated: event.truncated
      };
      setRecentDiffPreview(preview);
      appendDisplayMessage(
        systemMessage(
          `Prepared preview for ${event.toolName} on ${event.targetLabel}${event.truncated ? " (truncated)" : ""}.`,
          "warning"
        )
      );
      appendTrace("Preview ready", `${event.toolName} · ${event.targetLabel}`, "warning");
      return;
    }

    if (event.type === "tool-start") {
      appendDisplayMessage({
        id: crypto.randomUUID(),
        role: "tool",
        tone: event.confirmationRequired ? "warning" : "neutral",
        content: `${event.toolName} ${event.confirmationRequired ? "(awaiting confirmation)" : "(running)"}`
      });
      appendTrace(
        event.confirmationRequired ? "Awaiting approval" : "Running tool",
        event.toolName,
        event.confirmationRequired ? "warning" : "neutral"
      );
      return;
    }

    if (event.type === "tool-decision") {
      appendDisplayMessage(systemMessage(`${event.toolName}: ${event.decision}`, "success"));
      appendTrace("Decision recorded", `${event.toolName} · ${event.decision}`, "success");
      void refreshPermissionCounts();
      return;
    }

    appendDisplayMessage({
      id: crypto.randomUUID(),
      role: "tool",
      tone: event.result.success ? "success" : "error",
      content: `${event.toolName}: ${truncate(event.result.output)}`
    });
    appendTrace(
      event.result.success ? "Tool finished" : "Tool failed",
      event.toolName,
      event.result.success ? "success" : "error"
    );
  }

  async function handleSlashCommand(value: string): Promise<void> {
    const [command, ...args] = value.trim().split(/\s+/);

    switch (command) {
      case "/help":
        appendDisplayMessage({
          id: crypto.randomUUID(),
          role: "system",
          content: "Commands: /help /model [name] /clear /status /tools /resume [query] /diff /permissions [/clear-session|/clear-workspace] /quit"
        });
        return;
      case "/model": {
        const nextModel = args[0];
        if (!nextModel) {
          appendDisplayMessage(systemMessage(formatModelHelp(model)));
          return;
        }

        const resolvedModel = resolveModelSelection(nextModel);
        sessionRef.current.model = resolvedModel;
        setModel(resolvedModel);
        await persistSession();
        appendDisplayMessage(systemMessage(`Model set to ${resolvedModel}`, "success"));
        appendTrace("Model switched", resolvedModel, "success");
        return;
      }
      case "/clear":
        sessionRef.current.messages = [];
        setDisplayMessages([systemMessage("Conversation cleared.", "success")]);
        setScrollOffset(0);
        await persistSession();
        return;
      case "/status": {
        const config = await resolveConfig({ model: sessionRef.current.model });
        appendDisplayMessage({
          id: crypto.randomUUID(),
          role: "system",
          content: JSON.stringify(
            {
              sessionId: sessionRef.current.id,
              workspaceRoot: sessionRef.current.workspaceRoot,
              model: sessionRef.current.model,
              apiKeyConfigured: Boolean(config.apiKey),
              baseUrl: config.baseUrl,
              messageCount: sessionRef.current.messages.length,
              workspaceRuleCount,
              sessionRuleCount
            },
            null,
            2
          )
        });
        return;
      }
      case "/tools":
        appendDisplayMessage(systemMessage(toolsRef.current.map((tool) => tool.name).join("\n")));
        return;
      case "/resume":
        await openResume(args.join(" "));
        return;
      case "/diff":
        await openDiff();
        return;
      case "/permissions":
        if (args[0] === "clear-session") {
          clearSessionPermissionRules(sessionPermissionsRef.current);
          await refreshPermissionCounts();
          appendDisplayMessage(systemMessage("Cleared session permission rules.", "success"));
          return;
        }

        if (args[0] === "clear-workspace") {
          await clearWorkspacePermissionRules(sessionRef.current.workspaceRoot);
          await refreshPermissionCounts();
          appendDisplayMessage(systemMessage("Cleared workspace permission rules.", "success"));
          return;
        }

        await openPermissions();
        return;
      case "/quit":
        exit();
        return;
      default:
        appendDisplayMessage(systemMessage(`Unknown command: ${command}`, "warning"));
    }
  }

  async function submitPrompt(value: string): Promise<void> {
    appendDisplayMessage({
      id: crypto.randomUUID(),
      role: "user",
      content: value
    });

    const config = await resolveConfig({ model: sessionRef.current.model });
    if (!config.apiKey) {
      appendDisplayMessage(systemMessage("Missing API key. Run `deepseek code login` first.", "warning"));
      appendTrace("Blocked", "Missing API key", "error");
      return;
    }

    const provider = new DeepSeekProvider(config);
    hasStreamedAssistantRef.current = false;
    appendTrace("Request queued", sessionRef.current.model);
    appendTrace("Waiting for model");

    await runConversationTurn({
      session: sessionRef.current,
      prompt: value,
      provider,
      tools: toolsRef.current,
      sessionAllowedTools: sessionPermissionsRef.current.allowedTools,
      confirm: (request) =>
        new Promise<PendingActionDecision>((resolve) => {
          setOverlay({
            mode: "confirm",
            confirmation: {
              request,
              resolve
            }
          });
        }),
      callbacks: {
        onAssistantMessageCreated: (messageId) => {
          upsertAssistantMessage(messageId, "");
          appendTrace("Assistant started");
        },
        onAssistantDelta: (messageId, _delta, fullText) => {
          if (!hasStreamedAssistantRef.current && fullText.length > 0) {
            hasStreamedAssistantRef.current = true;
            appendTrace("Streaming response");
          }
          upsertAssistantMessage(messageId, fullText);
        },
        onToolEvent: (event) => {
          handleToolEvent(event);
        }
      }
    });
    appendTrace("Response complete", "Turn finished", "success");
    await refreshRecentSessions();
  }

  async function handleOverlaySubmit(value: string): Promise<void> {
    if (!overlay) {
      return;
    }

    const normalized = value.trim();

    if (overlay.mode === "confirm") {
      const decision = parseDecision(normalized, overlay.confirmation.request.allowedDecisions);
      if (!decision) {
        appendDisplayMessage(
          systemMessage(
            `Invalid decision. Allowed: ${overlay.confirmation.request.allowedDecisions.join(", ")}`,
            "warning"
          )
        );
        return;
      }

      overlay.confirmation.resolve(decision);
      setOverlay(null);
      appendDisplayMessage(systemMessage(`Decision recorded: ${decision}`, "success"));
      await refreshPermissionCounts();
      return;
    }

    if (overlay.mode === "resume") {
      if (normalized === "" || normalized === "close" || normalized === "cancel") {
        setOverlay(null);
        return;
      }

      const maybeIndex = Number.parseInt(normalized, 10);
      if (Number.isInteger(maybeIndex) && maybeIndex > 0) {
        const selected = overlay.matches[maybeIndex - 1];
        if (!selected) {
          appendDisplayMessage(systemMessage("That resume selection is out of range.", "warning"));
          return;
        }

        await resumeSession(selected);
        return;
      }

      await openResume(normalized);
      return;
    }

    if (overlay.mode === "permissions") {
      if (normalized === "" || normalized === "close" || normalized === "cancel") {
        setOverlay(null);
        return;
      }

      if (normalized === "clear-session") {
        clearSessionPermissionRules(sessionPermissionsRef.current);
        await refreshPermissionCounts();
        await openPermissions();
        return;
      }

      if (normalized === "clear-workspace") {
        await clearWorkspacePermissionRules(sessionRef.current.workspaceRoot);
        await refreshPermissionCounts();
        await openPermissions();
        return;
      }

      appendDisplayMessage(systemMessage("Unknown permissions command.", "warning"));
      return;
    }

    setOverlay(null);
  }

  async function handleSubmit(value: string): Promise<void> {
    const normalized = value.trim();
    setInput("");

    if (!normalized && overlay?.mode !== "diff") {
      return;
    }

    if (overlay) {
      await handleOverlaySubmit(normalized);
      return;
    }

    if (busy) {
      return;
    }

    setBusy(true);
    try {
      if (normalized.startsWith("/")) {
        await handleSlashCommand(normalized);
      } else {
        await submitPrompt(normalized);
      }
    } catch (error) {
      appendDisplayMessage(systemMessage((error as Error).message, "error"));
    } finally {
      setBusy(false);
    }
  }

  useInput((_input, key) => {
    if (overlay) {
      return;
    }

    if (key.pageUp) {
      setScrollOffset((current) => current + 5);
      return;
    }

    if (key.pageDown) {
      setScrollOffset((current) => Math.max(0, current - 5));
      return;
    }
  });

  return (
    <React.Fragment>
      <StatusBar
        workspaceRoot={sessionRef.current.workspaceRoot}
        model={model}
        busy={busy}
        messageCount={displayMessages.length}
        scrollOffset={scrollOffset}
        sessionId={sessionRef.current.id}
        workspaceRuleCount={workspaceRuleCount}
        sessionRuleCount={sessionRuleCount}
      />
      {showWelcomePanel ? (
        <WelcomePanel
          workspaceRoot={sessionRef.current.workspaceRoot}
          model={model}
          recentSessions={recentSessions}
        />
      ) : (
        <MessageList
          messages={displayMessages}
          windowSize={messageWindowSize}
          scrollOffset={scrollOffset}
        />
      )}
      <TracePanel
        items={traceItems}
        busy={busy}
      />
      {overlay?.mode === "confirm" ? (
        <OverlayPane
          title={`Confirm ${overlay.confirmation.request.toolName}`}
          body={[
            overlay.confirmation.request.message,
            overlay.confirmation.request.preview?.preview
          ]
            .filter(Boolean)
            .join("\n\n")}
          hint={`Allowed: ${overlay.confirmation.request.allowedDecisions.join(", ")}`}
        />
      ) : null}
      {overlay?.mode === "resume" ? (
        <OverlayPane
          title="Resume Session"
          body={formatResumeMatches(overlay.query, overlay.matches, overlay.message)}
          hint="Type a number, filter text, or close."
        />
      ) : null}
      {overlay?.mode === "diff" ? (
        <OverlayPane
          title={`Latest Diff · ${overlay.preview.targetLabel}`}
          body={overlay.preview.preview}
          hint={overlay.preview.truncated ? "Preview truncated. Press enter to close." : "Press enter to close."}
        />
      ) : null}
      {overlay?.mode === "permissions" ? (
        <OverlayPane
          title="Permissions"
          body={overlay.content}
          hint="Use clear-session, clear-workspace, or close."
        />
      ) : null}
      <PromptBar
        input={input}
        busy={busy}
        promptLabel={overlayPromptLabel(overlay)}
        footer={overlayFooter(overlay)}
        onChange={setInput}
        onSubmit={(value) => {
          void handleSubmit(value);
        }}
      />
    </React.Fragment>
  );
}
