import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  allowSessionTool,
  allowWorkspaceTool,
  clearSessionPermissionRules,
  clearWorkspacePermissionRules,
  createSessionPermissionState,
  loadWorkspacePermissionRules,
  resolvePermissionDecision
} from "../src/services/permissions.js";
import { clearAppPathsOverride } from "../src/services/paths.js";

describe("permission rules", () => {
  const originalEnv = { ...process.env };
  let tempRoot = "";

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "deepseek-code-permissions-"));
    process.env.DEEPSEEK_CODE_HOME = tempRoot;
  });

  afterEach(async () => {
    clearAppPathsOverride();
    process.env = { ...originalEnv };
    if (tempRoot) {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("prefers session permissions before workspace permissions", async () => {
    const state = createSessionPermissionState();
    allowSessionTool(state, "edit_file");
    await allowWorkspaceTool("/tmp/workspace", "write_file");

    await expect(
      resolvePermissionDecision({
        workspaceRoot: "/tmp/workspace",
        toolName: "edit_file",
        sessionState: state
      })
    ).resolves.toBe("session");

    await expect(
      resolvePermissionDecision({
        workspaceRoot: "/tmp/workspace",
        toolName: "write_file",
        sessionState: state
      })
    ).resolves.toBe("always");
  });

  it("clears session and workspace permission rules", async () => {
    const state = createSessionPermissionState();
    allowSessionTool(state, "edit_file");
    await allowWorkspaceTool("/tmp/workspace", "write_file");

    clearSessionPermissionRules(state);
    await clearWorkspacePermissionRules("/tmp/workspace");

    expect(state.allowedTools.size).toBe(0);
    await expect(loadWorkspacePermissionRules("/tmp/workspace")).resolves.toEqual([]);
  });
});
