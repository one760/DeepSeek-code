import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Session } from "../src/core/types.js";
import { resolveResumeQuery } from "../src/services/sessions.js";
import { clearAppPathsOverride } from "../src/services/paths.js";
import { createSession, listSessionSummaries, saveSession } from "../src/services/storage.js";

function createSessionWithPrompt(
  workspaceRoot: string,
  prompt: string,
  updatedAt: string
): Session {
  const session = createSession(workspaceRoot, "deepseek-chat");
  session.createdAt = updatedAt;
  session.updatedAt = updatedAt;
  session.lastActiveAt = updatedAt;
  session.messages.push({
    id: crypto.randomUUID(),
    role: "user",
    content: prompt,
    createdAt: updatedAt
  });
  return session;
}

describe("session summaries and resume queries", () => {
  const originalEnv = { ...process.env };
  let tempRoot = "";

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "deepseek-code-sessions-"));
    process.env.DEEPSEEK_CODE_HOME = tempRoot;
  });

  afterEach(async () => {
    clearAppPathsOverride();
    process.env = { ...originalEnv };
    if (tempRoot) {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("sorts session summaries by last activity descending", async () => {
    await saveSession(
      createSessionWithPrompt("/tmp/project-a", "Inspect auth flow", "2026-04-01T10:00:00.000Z")
    );
    await saveSession(
      createSessionWithPrompt("/tmp/project-b", "Fix build script", "2026-04-01T11:00:00.000Z")
    );

    const summaries = await listSessionSummaries();

    expect(summaries).toHaveLength(2);
    expect(summaries[0]?.title).toContain("Fix build script");
    expect(summaries[1]?.title).toContain("Inspect auth flow");
  });

  it("filters sessions by query and resolves unique matches", async () => {
    await saveSession(
      createSessionWithPrompt("/tmp/project-a", "Inspect auth flow", "2026-04-01T10:00:00.000Z")
    );
    await saveSession(
      createSessionWithPrompt("/tmp/project-b", "Review billing flow", "2026-04-01T11:00:00.000Z")
    );

    const result = await resolveResumeQuery("billing");

    expect(result.type).toBe("single");
    expect(result.matches[0]?.workspaceRoot).toBe("/tmp/project-b");
  });
});
