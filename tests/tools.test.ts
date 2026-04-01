import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { executeToolCalls } from "../src/tools/executor.js";
import { clearAppPathsOverride } from "../src/services/paths.js";
import { loadRecentDiffPreview } from "../src/services/storage.js";
import { createToolRegistry } from "../src/tools/registry.js";

describe("tool confirmation policies", () => {
  const registry = createToolRegistry();
  const workspaceRoot = "/tmp/workspace";
  const originalEnv = { ...process.env };
  let tempRoot = "";

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "deepseek-code-tools-"));
    process.env.DEEPSEEK_CODE_HOME = tempRoot;
  });

  afterEach(async () => {
    clearAppPathsOverride();
    process.env = { ...originalEnv };
    if (tempRoot) {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("does not require confirmation for read_file inside the workspace", () => {
    const tool = registry.get("read_file");
    const parsed = tool?.validator.parse({ path: "src/index.ts" });

    expect(tool?.requiresConfirmation(parsed, { workspaceRoot })).toBe(false);
  });

  it("requires confirmation for read_file outside the workspace", () => {
    const tool = registry.get("read_file");
    const parsed = tool?.validator.parse({ path: "../secret.txt" });

    expect(tool?.requiresConfirmation(parsed, { workspaceRoot })).toBe(true);
  });

  it("always requires confirmation for write_file and exec_shell", () => {
    const writeTool = registry.get("write_file");
    const shellTool = registry.get("exec_shell");

    expect(
      writeTool?.requiresConfirmation(
        writeTool.validator.parse({ path: "README.md", content: "hello" }),
        { workspaceRoot }
      )
    ).toBe(true);

    expect(
      shellTool?.requiresConfirmation(
        shellTool.validator.parse({ command: "pwd" }),
        { workspaceRoot }
      )
    ).toBe(true);
  });

  it("stores a recent diff preview when write_file is confirmed", async () => {
    const results = await executeToolCalls(
      [
        {
          id: "tool-1",
          name: "write_file",
          input: {
            path: "notes.txt",
            content: "hello world"
          }
        }
      ],
      registry,
      {
        workspaceRoot,
        sessionId: "session-1",
        sessionAllowedTools: new Set<string>()
      },
      async () => "once"
    );

    expect(results[0]?.success).toBe(true);
    const preview = await loadRecentDiffPreview("session-1");
    expect(preview?.targetLabel).toBe("notes.txt");
    expect(preview?.preview).toContain("+++ b/notes.txt");
  });
});
