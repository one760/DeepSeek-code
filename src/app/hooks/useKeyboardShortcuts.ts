import { useInput } from "ink";

export function useKeyboardShortcuts(params: {
  overlayOpen: boolean;
  inputMode: "text" | "command";
  onDismissOverlay: () => void;
  onExitCommandMode: () => void;
  onSelectPreviousCommand: () => void;
  onSelectNextCommand: () => void;
  onToggleThinkingExpanded: () => void;
  onScrollUp: () => void;
  onScrollDown: () => void;
  onPageUp: () => void;
  onPageDown: () => void;
  onScrollTop: () => void;
  onScrollBottom: () => void;
}): void {
  const {
    overlayOpen,
    inputMode,
    onDismissOverlay,
    onExitCommandMode,
    onSelectPreviousCommand,
    onSelectNextCommand,
    onToggleThinkingExpanded,
    onScrollUp,
    onScrollDown,
    onPageUp,
    onPageDown,
    onScrollTop,
    onScrollBottom
  } = params;

  useInput((inputValue, key) => {
    if (key.ctrl && inputValue.toLowerCase() === "t") {
      onToggleThinkingExpanded();
      return;
    }

    if (key.escape) {
      if (overlayOpen) {
        onDismissOverlay();
        return;
      }

      if (inputMode === "command") {
        onExitCommandMode();
      }
      return;
    }

    if (overlayOpen) {
      return;
    }

    if (inputMode === "command") {
      if (key.upArrow) {
        onSelectPreviousCommand();
        return;
      }

      if (key.downArrow) {
        onSelectNextCommand();
        return;
      }
    }

    if (key.upArrow) {
      onScrollUp();
      return;
    }

    if (key.downArrow) {
      onScrollDown();
      return;
    }

    if (key.pageUp) {
      onPageUp();
      return;
    }

    if (key.pageDown) {
      onPageDown();
      return;
    }

    if (key.home) {
      onScrollTop();
      return;
    }

    if (key.end) {
      onScrollBottom();
    }
  });
}
