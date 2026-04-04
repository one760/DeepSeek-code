import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type {
  PendingActionDecision,
  Session,
  SessionSummary
} from "../../core/types.js";
import { runConversationTurn } from "../../core/runConversationTurn.js";
import { DeepSeekProvider } from "../../provider/deepseek/DeepSeekProvider.js";
import { resolveConfig } from "../../services/config.js";
import { formatCost, formatTokenUsage, estimateCost } from "../../services/costEstimation.js";
import { getGitStatusSummary } from "../../services/git.js";
import {
  clearSessionPermissionRules,
  clearWorkspacePermissionRules,
  createSessionPermissionState,
  getSessionPermissionRules,
  loadWorkspacePermissionRules
} from "../../services/permissions.js";
import { loadProjectInstructions } from "../../services/projectInstructions.js";
import { resolveResumeQuery } from "../../services/sessions.js";
import {
  loadRecentDiffPreview,
  loadSession,
  listSessionSummaries,
  saveSession
} from "../../services/storage.js";
import type { ToolRunEvent } from "../../tools/executor.js";
import { getToolDefinitions } from "../../tools/registry.js";
import { buildCommandPalette } from "../commandPalette.js";
import { createAppActions } from "../appActions.js";
import {
  createSlashCommandRegistry,
  executeRegisteredSlashCommand
} from "../commandRegistry.js";
import {
  formatTimestamp,
  parseDecision,
  systemMessage,
  toDisplayMessages,
  truncate
} from "../formatters.js";
import type {
  AppModeState,
  CommandPaletteOption,
  ConfirmationRequest,
  DisplayMessage,
  TraceItem
} from "../types.js";
import type { AppScreenViewModel } from "../viewModel.js";
import { createInitialViewState, viewStateReducer } from "../viewStateReducer.js";

function createTraceItem(
  label: string,
  detail?: string,
  tone: TraceItem["tone"] = "neutral",
  status?: TraceItem["status"]
): TraceItem {
  return {
    id: crypto.randomUUID(),
    label,
    detail,
    tone,
    status,
    createdAt: new Date().toISOString()
  };
}

function canClearInput(value: string): boolean {
  return value.trim().startsWith("/");
}

type PermissionOperation = "show" | "clear-session" | "clear-workspace";

export function useDeepseekAppController(params: {
  initialSession: Session;
  terminalRows?: number;
  onExit: () => void;
}): {
  viewModel: AppScreenViewModel;
  setInput: (value: string) => void;
  handleSubmit: (value: string) => Promise<void>;
  dismissOverlay: () => void;
  exitCommandMode: () => void;
  selectPreviousCommand: () => void;
  selectNextCommand: () => void;
  toggleThinkingExpanded: () => void;
  scrollUp: () => void;
  scrollDown: () => void;
  pageUp: () => void;
  pageDown: () => void;
  scrollToTop: () => void;
  scrollToBottom: () => void;
} {
  const { initialSession, terminalRows, onExit } = params;
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [displayMessages, setDisplayMessages] = useState<DisplayMessage[]>(
    toDisplayMessages(initialSession)
  );
  const [model, setModel] = useState(initialSession.model);
  const [viewState, dispatchViewState] = useReducer(viewStateReducer, undefined, createInitialViewState);
  const [workspaceRuleCount, setWorkspaceRuleCount] = useState(0);
  const [sessionRuleCount, setSessionRuleCount] = useState(0);
  const [recentDiffPreview, setRecentDiffPreview] = useState<AppScreenViewModel["recentDiffPreview"]>(
    null
  );
  const [recentSessions, setRecentSessions] = useState<SessionSummary[]>([]);
  const [traceItems, setTraceItems] = useState<TraceItem[]>([]);
  const [commandSelectedIndex, setCommandSelectedIndex] = useState(0);
  const [thinkingExpanded, setThinkingExpanded] = useState(false);
  const sessionRef = useRef(initialSession);
  const toolsRef = useRef(getToolDefinitions());
  const sessionPermissionsRef = useRef(createSessionPermissionState());
  const scrollOffsetRef = useRef(0);
  const hasStreamedAssistantRef = useRef(false);
  const overlayRef = useRef<AppModeState["overlay"]>(viewState.overlay);

  useEffect(() => {
    scrollOffsetRef.current = scrollOffset;
  }, [scrollOffset]);

  useEffect(() => {
    overlayRef.current = viewState.overlay;
  }, [viewState.overlay]);

  const refreshPermissionCounts = useCallback(async () => {
    const workspaceRules = await loadWorkspacePermissionRules(sessionRef.current.workspaceRoot);
    const sessionRules = getSessionPermissionRules(sessionPermissionsRef.current);
    setWorkspaceRuleCount(workspaceRules.length);
    setSessionRuleCount(sessionRules.length);
  }, []);

  const refreshRecentSessions = useCallback(async () => {
    const sessions = await listSessionSummaries();
    setRecentSessions(
      sessions.filter((session) => session.id !== sessionRef.current.id && session.messageCount > 0)
    );
  }, []);

  useEffect(() => {
    void refreshPermissionCounts();
    void refreshRecentSessions();
  }, [refreshPermissionCounts, refreshRecentSessions]);

  const commandPalette = useMemo(
    () =>
      buildCommandPalette({
        input,
        currentModel: model,
        recentSessions
      }),
    [input, model, recentSessions]
  );

  useEffect(() => {
    setCommandSelectedIndex(0);
  }, [commandPalette.title, input]);

  useEffect(() => {
    setCommandSelectedIndex((current) => {
      if (commandPalette.options.length === 0) {
        return 0;
      }

      return Math.max(0, Math.min(current, commandPalette.options.length - 1));
    });
  }, [commandPalette.options.length]);

  const overlayVisible = useMemo(() => Boolean(viewState.overlay), [viewState.overlay]);
  const showWelcomeLine = useMemo(
    () =>
      sessionRef.current.messages.length === 0 &&
      displayMessages.length === 0 &&
      !overlayVisible,
    [displayMessages.length, overlayVisible]
  );
  const messageWindowSize = useMemo(
    () => Math.max(6, (terminalRows ?? 24) - (overlayVisible ? 13 : 8)),
    [overlayVisible, terminalRows]
  );

  useEffect(() => {
    setScrollOffset((current) =>
      Math.max(0, Math.min(current, Math.max(0, displayMessages.length - messageWindowSize)))
    );
  }, [displayMessages.length, messageWindowSize]);

  const maybeStickToBottom = useCallback(() => {
    if (scrollOffsetRef.current === 0) {
      setScrollOffset(0);
    }
  }, []);

  const appendDisplayMessage = useCallback(
    (message: DisplayMessage) => {
      setDisplayMessages((current) => [...current, message]);
      maybeStickToBottom();
    },
    [maybeStickToBottom]
  );

  const appendTrace = useCallback(
    (
      label: string,
      detail?: string,
      tone: TraceItem["tone"] = "neutral",
      status?: TraceItem["status"]
    ) => {
      setTraceItems((current) => [...current, createTraceItem(label, detail, tone, status)].slice(-20));
    },
    []
  );

  const upsertAssistantMessage = useCallback(
    (messageId: string, content: string) => {
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
    },
    [maybeStickToBottom]
  );

  const persistSession = useCallback(async () => {
    sessionRef.current.updatedAt = new Date().toISOString();
    await saveSession(sessionRef.current);
    await refreshRecentSessions();
  }, [refreshRecentSessions]);

  const openPermissions = useCallback(async () => {
    const workspaceRules = await loadWorkspacePermissionRules(sessionRef.current.workspaceRoot);
    const sessionRules = getSessionPermissionRules(sessionPermissionsRef.current);
    dispatchViewState({
      type: "open-permissions",
      workspaceRoot: sessionRef.current.workspaceRoot,
      workspaceRules: workspaceRules.map((rule) => rule.toolName),
      sessionRules: sessionRules.map((rule) => rule.toolName)
    });
  }, []);

  const resumeSession = useCallback(
    async (sessionSummary: SessionSummary) => {
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
      dispatchViewState({ type: "close-overlay" });
      setInput("");
      setRecentDiffPreview(await loadRecentDiffPreview(loaded.id));
      appendTrace("Session resumed", loaded.title, "success");
      await refreshPermissionCounts();
      await refreshRecentSessions();
    },
    [appendDisplayMessage, appendTrace, refreshPermissionCounts, refreshRecentSessions]
  );

  const clearPermissionRules = useCallback(
    async (operation: Exclude<PermissionOperation, "show">) => {
      if (operation === "clear-session") {
        clearSessionPermissionRules(sessionPermissionsRef.current);
        await refreshPermissionCounts();
        appendDisplayMessage(systemMessage("Cleared session permission rules.", "success"));
        return;
      }

      await clearWorkspacePermissionRules(sessionRef.current.workspaceRoot);
      await refreshPermissionCounts();
      appendDisplayMessage(systemMessage("Cleared workspace permission rules.", "success"));
    },
    [appendDisplayMessage, refreshPermissionCounts]
  );

  const runPermissionOperation = useCallback(
    async (operation: PermissionOperation, reopenOverlay = false) => {
      if (operation === "show") {
        await openPermissions();
        return;
      }

      await clearPermissionRules(operation);
      if (reopenOverlay) {
        await openPermissions();
      }
    },
    [clearPermissionRules, openPermissions]
  );

  const showStatus = useCallback(async () => {
    const config = await resolveConfig({ model: sessionRef.current.model });
    appendDisplayMessage({
      id: crypto.randomUUID(),
      role: "system-muted",
      content: JSON.stringify(
        {
          sessionId: sessionRef.current.id,
          workspaceRoot: sessionRef.current.workspaceRoot,
          model: sessionRef.current.model,
          apiKeyConfigured: Boolean(config.apiKey),
          baseUrl: config.baseUrl,
          messageCount: sessionRef.current.messages.length,
          tokenUsage: sessionRef.current.tokenUsage,
          workspaceRuleCount,
          sessionRuleCount
        },
        null,
        2
      )
    });
  }, [appendDisplayMessage, sessionRuleCount, workspaceRuleCount]);

  const showUsage = useCallback(async () => {
    const usage = sessionRef.current.tokenUsage;
    if (!usage) {
      appendDisplayMessage(systemMessage("No token usage has been recorded yet.", "warning"));
      return;
    }

    const estimatedCost = estimateCost(
      sessionRef.current.model,
      usage.totalInputTokens,
      usage.totalOutputTokens
    );
    appendDisplayMessage(
      systemMessage(
        [
          formatTokenUsage(usage, sessionRef.current.model),
          `turns: ${usage.turnCount}`,
          `total tokens: ${usage.totalTokens}`,
          `estimated cost: ${formatCost(estimatedCost)}`
        ].join("\n"),
        "neutral"
      )
    );
  }, [appendDisplayMessage]);

  const openResume = useCallback(
    async (query = "") => {
      const result = await resolveResumeQuery(query);
      if (result.type === "single") {
        await resumeSession(result.matches[0]);
        return;
      }

      dispatchViewState({
        type: "open-resume",
        query,
        matches: result.matches,
        message: result.type === "none" ? "No sessions matched this query." : undefined
      });
    },
    [resumeSession]
  );

  const openDiff = useCallback(async () => {
    const preview = recentDiffPreview ?? (await loadRecentDiffPreview(sessionRef.current.id));
    if (!preview) {
      appendDisplayMessage(systemMessage("No recent diff preview is available.", "warning"));
      return;
    }

    setRecentDiffPreview(preview);
    dispatchViewState({
      type: "open-diff",
      preview
    });
  }, [appendDisplayMessage, recentDiffPreview]);

  const handleToolEvent = useCallback(
    (event: ToolRunEvent) => {
      if (event.type === "tool-preview") {
        const preview = {
          sessionId: sessionRef.current.id,
          toolName: event.toolName,
          targetLabel: event.targetLabel,
          preview: event.preview,
          createdAt: new Date().toISOString(),
          truncated: Boolean(event.truncated)
        };
        setRecentDiffPreview(preview);
        appendDisplayMessage({
          id: crypto.randomUUID(),
          role: "tool-summary",
          toolName: event.toolName,
          success: true,
          content: `${event.targetLabel}${event.truncated ? " · truncated" : ""}\n${truncate(event.preview)}`
        });
        appendTrace("Preview ready", `${event.toolName} · ${event.targetLabel}`, "warning", "done");
        return;
      }

      if (event.type === "tool-start") {
        appendDisplayMessage({
          id: crypto.randomUUID(),
          role: "tool-summary",
          toolName: event.toolName,
          content: event.confirmationRequired ? "Awaiting confirmation" : "Running"
        });
        appendTrace(
          event.confirmationRequired ? "Awaiting approval" : "Using tool",
          event.toolName,
          event.confirmationRequired ? "warning" : "neutral",
          event.confirmationRequired ? "pending" : "running"
        );
        return;
      }

      if (event.type === "tool-decision" && event.decision) {
        appendDisplayMessage({
          id: crypto.randomUUID(),
          role: "tool-summary",
          toolName: event.toolName,
          success: event.decision !== "deny",
          content: `Decision: ${event.decision}`
        });
        appendTrace("Decision recorded", `${event.toolName} · ${event.decision}`, "success", "done");
        void refreshPermissionCounts();
        return;
      }

      if (event.type === "tool-end" && event.result) {
        appendDisplayMessage({
          id: crypto.randomUUID(),
          role: "tool-summary",
          tone: event.result.success ? "success" : "error",
          toolName: event.toolName,
          success: event.result.success,
          content: truncate(event.result.output)
        });
        appendTrace(
          event.result.success ? "Tool finished" : "Tool failed",
          event.toolName,
          event.result.success ? "success" : "error",
          event.result.success ? "done" : "error"
        );
      }
    },
    [appendDisplayMessage, appendTrace, refreshPermissionCounts]
  );

  const dismissOverlay = useCallback(() => {
    const currentOverlay = overlayRef.current;
    if (currentOverlay?.mode === "confirm") {
      currentOverlay.confirmation.resolve("deny");
    }
    dispatchViewState({ type: "close-overlay" });
  }, []);

  const clearConversation = useCallback(async () => {
    sessionRef.current.messages = [];
    setDisplayMessages([]);
    setTraceItems([]);
    setScrollOffset(0);
    setRecentDiffPreview(null);
    await persistSession();
    appendDisplayMessage(systemMessage("Conversation cleared.", "success"));
  }, [appendDisplayMessage, persistSession]);

  const appActions = useMemo(
    () =>
      createAppActions({
        model,
        session: sessionRef,
        appendDisplayMessage,
        appendTrace,
        setModel,
        persistSession,
        clearConversation,
        showStatus,
        showUsage,
        openResume,
        openDiff,
        runPermissionOperation,
        onExit,
        getToolNames: () => toolsRef.current.map((tool) => tool.name)
      }),
    [
      appendDisplayMessage,
      appendTrace,
      clearConversation,
      model,
      onExit,
      openDiff,
      openResume,
      persistSession,
      runPermissionOperation,
      showStatus,
      showUsage,
      setModel
    ]
  );

  const slashCommandRegistry = useMemo(
    () => createSlashCommandRegistry(appActions),
    [appActions]
  );

  const handleSlashCommand = useCallback(
    async (value: string) => {
      const execution = await executeRegisteredSlashCommand(slashCommandRegistry, value);
      if (!execution.handled) {
        appendDisplayMessage(systemMessage(`Unknown command: ${execution.key}`, "warning"));
      }
    },
    [appendDisplayMessage, slashCommandRegistry]
  );

  const executeCommandOption = useCallback(
    async (option: CommandPaletteOption | undefined) => {
      if (!option || option.disabled) {
        return;
      }

      switch (option.action.type) {
        case "submenu":
          setInput(`/${option.action.submenu}`);
          return;
        case "command":
          await handleSlashCommand(`/${option.action.command}`);
          setInput("");
          return;
        case "model":
          await handleSlashCommand(`/model ${option.action.model}`);
          setInput("");
          return;
        case "permission":
          await runPermissionOperation(option.action.operation);
          setInput("");
          return;
        case "resume": {
          const selected = recentSessions.find((session) => session.id === option.action.sessionId);
          if (!selected) {
            appendDisplayMessage(systemMessage("That resume selection is no longer available.", "warning"));
            setInput("");
            return;
          }
          await resumeSession(selected);
          return;
        }
      }
    },
    [
      handleSlashCommand,
      recentSessions,
      resumeSession,
      runPermissionOperation,
      appendDisplayMessage
    ]
  );

  const submitPrompt = useCallback(
    async (value: string) => {
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
      const [gitStatus, projectInstructions] = await Promise.all([
        getGitStatusSummary(sessionRef.current.workspaceRoot),
        loadProjectInstructions(sessionRef.current.workspaceRoot)
      ]);
      hasStreamedAssistantRef.current = false;
      appendTrace("Request queued", sessionRef.current.model, "neutral", "pending");
      if (projectInstructions) {
        appendTrace("Project instructions", ".deepseek-code.md loaded", "success", "done");
      }

      appendTrace("Waiting for model", undefined, "neutral", "pending");
      await runConversationTurn({
        session: sessionRef.current,
        prompt: value,
        provider,
        tools: toolsRef.current,
        sessionAllowedTools: sessionPermissionsRef.current.allowedTools,
        systemPromptContext: {
          workspaceRoot: sessionRef.current.workspaceRoot,
          model: sessionRef.current.model,
          gitBranch: gitStatus.insideWorkTree ? gitStatus.branch : undefined,
          projectInstructions,
          tools: toolsRef.current
        },
        confirm: (request) =>
          new Promise<PendingActionDecision>((resolve) => {
            const confirmation: ConfirmationRequest = {
              request,
              resolve
            };
            dispatchViewState({
              type: "open-confirm",
              confirmation
            });
          }),
        callbacks: {
          onAssistantMessageCreated: (messageId) => {
            upsertAssistantMessage(messageId, "");
            appendTrace("Assistant started", undefined, "neutral", "running");
          },
          onAssistantDelta: (messageId, _delta, fullText) => {
            if (!hasStreamedAssistantRef.current && fullText.length > 0) {
              hasStreamedAssistantRef.current = true;
              appendTrace("Streaming response", undefined, "warning", "running");
            }
            upsertAssistantMessage(messageId, fullText);
          },
          onToolEvent: (event) => {
            handleToolEvent(event);
          },
          onContextTruncated: (originalCount, truncatedCount, estimatedTokens) => {
            appendTrace(
              "Context truncated",
              `${originalCount}→${truncatedCount} msgs · ~${estimatedTokens} tokens`,
              "warning",
              "done"
            );
            appendDisplayMessage(
              systemMessage(`Context truncated: ${originalCount} → ${truncatedCount} messages`, "warning")
            );
          },
          onRetry: (attempt, error, delayMs) => {
            appendTrace(
              "Retrying request",
              `attempt ${attempt} · ${delayMs}ms · ${truncate(error, 120)}`,
              "warning",
              "running"
            );
          }
        }
      });
      appendTrace("Response complete", "Turn finished", "success", "done");
      await refreshRecentSessions();
    },
    [appendDisplayMessage, appendTrace, handleToolEvent, refreshRecentSessions, upsertAssistantMessage]
  );

  const handleOverlaySubmit = useCallback(
    async (value: string) => {
      const currentOverlay = overlayRef.current;
      if (!currentOverlay) {
        return;
      }

      const normalized = value.trim();
      if (currentOverlay.mode === "confirm") {
        const decision = parseDecision(
          normalized,
          currentOverlay.confirmation.request.allowedDecisions
        );
        if (!decision) {
          appendDisplayMessage(
            systemMessage(
              `Invalid decision. Allowed: ${currentOverlay.confirmation.request.allowedDecisions.join(", ")}`,
              "warning"
            )
          );
          return;
        }

        currentOverlay.confirmation.resolve(decision);
        dispatchViewState({ type: "close-overlay" });
        appendDisplayMessage(systemMessage(`Decision recorded: ${decision}`, "success"));
        await refreshPermissionCounts();
        return;
      }

      if (currentOverlay.mode === "resume") {
        if (normalized === "" || normalized === "close" || normalized === "cancel") {
          dispatchViewState({ type: "close-overlay" });
          return;
        }

        const maybeIndex = Number.parseInt(normalized, 10);
        if (Number.isInteger(maybeIndex) && maybeIndex > 0) {
          const selected = currentOverlay.matches[maybeIndex - 1];
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

      if (currentOverlay.mode === "permissions") {
        if (normalized === "" || normalized === "close" || normalized === "cancel") {
          dispatchViewState({ type: "close-overlay" });
          return;
        }

        if (normalized === "clear-session") {
          await runPermissionOperation("clear-session", true);
          return;
        }

        if (normalized === "clear-workspace") {
          await runPermissionOperation("clear-workspace", true);
          return;
        }

        appendDisplayMessage(systemMessage("Unknown permissions command.", "warning"));
        return;
      }

      dispatchViewState({ type: "close-overlay" });
    },
    [appendDisplayMessage, openResume, resumeSession, runPermissionOperation]
  );

  const handleSubmit = useCallback(
    async (value: string) => {
      const normalized = value.trim();
      setInput("");

      if (!normalized && overlayRef.current?.mode !== "diff") {
        return;
      }

      if (overlayRef.current) {
        await handleOverlaySubmit(normalized);
        return;
      }

      if (busy) {
        return;
      }

      setBusy(true);
      try {
        if (commandPalette.inputMode === "command") {
          const selected = commandPalette.options[commandSelectedIndex];
          if (selected) {
            await executeCommandOption(selected);
            return;
          }
        }

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
    },
    [
      appendDisplayMessage,
      busy,
      commandPalette.inputMode,
      commandPalette.options,
      commandSelectedIndex,
      executeCommandOption,
      handleOverlaySubmit,
      handleSlashCommand,
      submitPrompt
    ]
  );

  const exitCommandMode = useCallback(() => {
    if (canClearInput(input)) {
      setInput("");
    }
  }, [input]);

  const selectPreviousCommand = useCallback(() => {
    setCommandSelectedIndex((current) => {
      if (commandPalette.options.length === 0) {
        return 0;
      }

      return current <= 0 ? commandPalette.options.length - 1 : current - 1;
    });
  }, [commandPalette.options.length]);

  const selectNextCommand = useCallback(() => {
    setCommandSelectedIndex((current) => {
      if (commandPalette.options.length === 0) {
        return 0;
      }

      return current >= commandPalette.options.length - 1 ? 0 : current + 1;
    });
  }, [commandPalette.options.length]);

  const toggleThinkingExpanded = useCallback(() => {
    setThinkingExpanded((current) => !current);
  }, []);

  const scrollUp = useCallback(() => {
    setScrollOffset((current) => current + 1);
  }, []);

  const scrollDown = useCallback(() => {
    setScrollOffset((current) => Math.max(0, current - 1));
  }, []);

  const pageUp = useCallback(() => {
    setScrollOffset((current) => current + 5);
  }, []);

  const pageDown = useCallback(() => {
    setScrollOffset((current) => Math.max(0, current - 5));
  }, []);

  const scrollToTop = useCallback(() => {
    setScrollOffset(Math.max(0, displayMessages.length - messageWindowSize));
  }, [displayMessages.length, messageWindowSize]);

  const scrollToBottom = useCallback(() => {
    setScrollOffset(0);
  }, []);

  const viewModel = useMemo<AppScreenViewModel>(
    () => ({
      input,
      inputMode: commandPalette.inputMode,
      busy,
      scrollOffset,
      displayMessages,
      model,
      overlay: viewState.overlay,
      workspaceRuleCount,
      sessionRuleCount,
      recentDiffPreview,
      recentSessions,
      traceItems,
      workspaceRoot: sessionRef.current.workspaceRoot,
      sessionId: sessionRef.current.id,
      tokenUsageSummary: formatTokenUsage(sessionRef.current.tokenUsage, model),
      showWelcomeLine,
      messageWindowSize,
      commandPaletteTitle: commandPalette.title,
      commandOptions: commandPalette.options,
      commandSelectedIndex,
      thinkingExpanded
    }),
    [
      busy,
      commandPalette.inputMode,
      commandPalette.options,
      commandPalette.title,
      commandSelectedIndex,
      displayMessages,
      input,
      messageWindowSize,
      model,
      viewState.overlay,
      recentDiffPreview,
      recentSessions,
      scrollOffset,
      sessionRuleCount,
      showWelcomeLine,
      thinkingExpanded,
      traceItems,
      workspaceRuleCount
    ]
  );

  return {
    viewModel,
    setInput,
    handleSubmit,
    dismissOverlay,
    exitCommandMode,
    selectPreviousCommand,
    selectNextCommand,
    toggleThinkingExpanded,
    scrollUp,
    scrollDown,
    pageUp,
    pageDown,
    scrollToTop,
    scrollToBottom
  };
}
