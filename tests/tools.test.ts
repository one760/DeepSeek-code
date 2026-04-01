import { describe, expect, it } from "vitest";
import { createToolRegistry } from "../src/tools/registry.js";

describe("tool confirmation policies", () => {
  const registry = createToolRegistry();
  const workspaceRoot = "/tmp/workspace";

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
});
