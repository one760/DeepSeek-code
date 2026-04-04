import type {
  OverlayState,
  DisplayMessage,
  TraceItem,
  CommandPaletteOption,
  InputMode
} from "./types.js";
import type { SessionSummary, RecentDiffPreview } from "../core/types.js";

export type AppScreenViewModel = {
  input: string;
  inputMode: InputMode;
  busy: boolean;
  scrollOffset: number;
  displayMessages: DisplayMessage[];
  model: string;
  overlay: OverlayState;
  workspaceRuleCount: number;
  sessionRuleCount: number;
  recentDiffPreview: RecentDiffPreview | null;
  recentSessions: SessionSummary[];
  traceItems: TraceItem[];
  workspaceRoot: string;
  sessionId: string;
  tokenUsageSummary: string;
  showWelcomeLine: boolean;
  messageWindowSize: number;
  commandPaletteTitle: string;
  commandOptions: CommandPaletteOption[];
  commandSelectedIndex: number;
  thinkingExpanded: boolean;
};
