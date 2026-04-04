import type { MutableRefObject } from "react";
import type { Session } from "../core/types.js";
import { modelSupportsToolCalls } from "../provider/deepseek/DeepSeekProvider.js";
import { formatModelCapabilityNotice, systemMessage } from "./formatters.js";
import { formatModelHelp, resolveModelSelection } from "./modelSelection.js";
import type { DisplayMessage, TraceItem } from "./types.js";

const COMMAND_HELP_TEXT =
  "Commands: /help /model /resume /permissions /tools /diff /status /usage /clear /quit";

type PermissionOperation = "show" | "clear-session" | "clear-workspace";

export type AppActionsDeps = {
  model: string;
  session: MutableRefObject<Session>;
  appendDisplayMessage: (message: DisplayMessage) => void;
  appendTrace: (label: string, detail?: string, tone?: TraceItem["tone"]) => void;
  setModel: (model: string) => void;
  persistSession: () => Promise<void>;
  clearConversation: () => Promise<void>;
  showStatus: () => Promise<void>;
  showUsage: () => Promise<void>;
  openResume: (query?: string) => Promise<void>;
  openDiff: () => Promise<void>;
  runPermissionOperation: (
    operation: PermissionOperation,
    reopenOverlay?: boolean
  ) => Promise<void>;
  onExit: () => void;
  getToolNames: () => string[];
};

export function createAppActions(deps: AppActionsDeps) {
  return {
    help: async () => {
      deps.appendDisplayMessage(systemMessage(COMMAND_HELP_TEXT));
    },
    model: async (args: string[]) => {
      const nextModel = args[0];
      if (!nextModel) {
        deps.appendDisplayMessage(systemMessage(formatModelHelp(deps.model)));
        return;
      }

      const resolvedModel = resolveModelSelection(nextModel);
      deps.session.current.model = resolvedModel;
      deps.setModel(resolvedModel);
      await deps.persistSession();
      deps.appendDisplayMessage(systemMessage(`Model set to ${resolvedModel}`, "success"));
      deps.appendDisplayMessage(
        systemMessage(
          formatModelCapabilityNotice(resolvedModel),
          modelSupportsToolCalls(resolvedModel) ? "neutral" : "warning"
        )
      );
      deps.appendTrace(
        "Model switched",
        resolvedModel,
        "success"
      );
    },
    clear: async () => {
      await deps.clearConversation();
    },
    status: async () => {
      await deps.showStatus();
    },
    usage: async () => {
      await deps.showUsage();
    },
    tools: async () => {
      deps.appendDisplayMessage(
        systemMessage(
          deps.getToolNames().join("\n")
        )
      );
    },
    resume: async (args: string[]) => {
      await deps.openResume(args.join(" "));
    },
    diff: async () => {
      await deps.openDiff();
    },
    permissions: async (args: string[]) => {
      await deps.runPermissionOperation(
        args[0] === "clear-session" || args[0] === "clear-workspace"
          ? args[0]
          : "show"
      );
    },
    quit: () => {
      deps.onExit();
    }
  };
}
