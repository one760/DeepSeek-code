import React from "react";
import { useApp, useStdout } from "ink";
import type { Session } from "../core/types.js";
import { ConversationLayout } from "./components/ConversationLayout.js";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts.js";
import { useDeepseekAppController } from "./hooks/useDeepseekAppController.js";

export function DeepseekCodeApp({
  initialSession
}: {
  initialSession: Session;
}): React.ReactNode {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const controller = useDeepseekAppController({
    initialSession,
    terminalRows: stdout.rows,
    onExit: exit
  });

  useKeyboardShortcuts({
    overlayOpen: Boolean(controller.viewModel.overlay),
    inputMode: controller.viewModel.inputMode,
    onDismissOverlay: controller.dismissOverlay,
    onExitCommandMode: controller.exitCommandMode,
    onSelectPreviousCommand: controller.selectPreviousCommand,
    onSelectNextCommand: controller.selectNextCommand,
    onToggleThinkingExpanded: controller.toggleThinkingExpanded,
    onScrollUp: controller.scrollUp,
    onScrollDown: controller.scrollDown,
    onPageUp: controller.pageUp,
    onPageDown: controller.pageDown,
    onScrollTop: controller.scrollToTop,
    onScrollBottom: controller.scrollToBottom
  });

  return (
    <ConversationLayout
      viewModel={controller.viewModel}
      onInputChange={controller.setInput}
      onSubmit={(value) => {
        void controller.handleSubmit(value);
      }}
    />
  );
}
