import { describe, expect, it } from "vitest";
import { buildSystemPrompt, createSystemMessage } from "../src/core/systemPrompt.js";

describe("system prompt", () => {
  it("builds a system prompt with workspace, model, branch, tools, and project instructions", () => {
    const prompt = buildSystemPrompt({
      workspaceRoot: "/tmp/project",
      model: "deepseek-chat",
      gitBranch: "main",
      projectInstructions: "Use pnpm.",
      tools: [
        {
          name: "read_file",
          description: "Read a file",
          inputSchema: { type: "object" },
          validator: {} as never,
          isReadOnly: true,
          requiresConfirmation: () => false,
          execute: async () => ({ success: true, output: "ok" })
        }
      ]
    });

    expect(prompt).toContain("Workspace root: /tmp/project");
    expect(prompt).toContain("Git branch: main");
    expect(prompt).toContain("Project instructions from .deepseek-code.md");
    expect(prompt).toContain("read_file");
  });

  it("creates a system message without persisting special state", () => {
    const message = createSystemMessage({
      workspaceRoot: "/tmp/project",
      model: "deepseek-chat"
    });

    expect(message.role).toBe("system");
    expect(message.content).toContain("/tmp/project");
  });
});
