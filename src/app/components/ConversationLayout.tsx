import React from "react";
import type { AppScreenViewModel } from "../viewModel.js";
import { Box } from "ink";
import { CommandPaletteInline } from "./CommandPaletteInline.js";
import { ConversationStream } from "./ConversationStream.js";
import { InlineThinkingSummary } from "./InlineThinkingSummary.js";
import { InlineStatusBar } from "./InlineStatusBar.js";
import { InputComposer } from "./InputComposer.js";
import { OverlayRenderer } from "./OverlayRenderer.js";

export function ConversationLayout({
  viewModel,
  onInputChange,
  onSubmit
}: {
  viewModel: AppScreenViewModel;
  onInputChange: (value: string) => void;
  onSubmit: (value: string) => void;
}): React.ReactNode {
  return (
    <Box flexDirection="column">
      <InlineStatusBar
        workspaceRoot={viewModel.workspaceRoot}
        sessionId={viewModel.sessionId}
        model={viewModel.model}
        busy={viewModel.busy}
        tokenUsageSummary={viewModel.tokenUsageSummary}
      />
      <ConversationStream
        messages={viewModel.displayMessages}
        windowSize={viewModel.messageWindowSize}
        scrollOffset={viewModel.scrollOffset}
        showWelcomeLine={viewModel.showWelcomeLine}
      />
      <InlineThinkingSummary
        items={viewModel.traceItems}
        expanded={viewModel.thinkingExpanded}
        busy={viewModel.busy}
      />
      <OverlayRenderer overlay={viewModel.overlay} />
      <InputComposer
        input={viewModel.input}
        busy={viewModel.busy}
        onChange={onInputChange}
        onSubmit={onSubmit}
      />
      {viewModel.inputMode === "command" ? (
        <CommandPaletteInline
          title={viewModel.commandPaletteTitle}
          options={viewModel.commandOptions}
          selectedIndex={viewModel.commandSelectedIndex}
        />
      ) : null}
    </Box>
  );
}
