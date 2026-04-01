import React from "react";
import { render } from "ink";
import { DeepseekCodeApp } from "./DeepseekCodeApp.js";
import { resolveConfig } from "../services/config.js";
import { createSession, ensureAppDirectories, saveSession } from "../services/storage.js";
import { getWorkspaceRoot } from "../services/platform.js";

export async function runInteractiveApp(): Promise<void> {
  await ensureAppDirectories();
  const config = await resolveConfig();
  const workspaceRoot = getWorkspaceRoot();
  const session = createSession(workspaceRoot, config.model);
  await saveSession(session);
  const app = render(<DeepseekCodeApp initialSession={session} />);
  await app.waitUntilExit();
}
