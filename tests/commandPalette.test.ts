import { describe, expect, it } from "vitest";
import { buildCommandPalette } from "../src/app/commandPalette.js";

describe("buildCommandPalette", () => {
  it("shows root commands when input starts with slash", () => {
    const palette = buildCommandPalette({
      input: "/",
      currentModel: "deepseek-chat",
      recentSessions: []
    });

    expect(palette.inputMode).toBe("command");
    expect(palette.options.map((option) => option.label)).toContain("/model");
    expect(palette.options.map((option) => option.label)).toContain("/resume");
    expect(palette.options.map((option) => option.label)).toContain("/usage");
  });

  it("shows model choices for /model", () => {
    const palette = buildCommandPalette({
      input: "/model",
      currentModel: "deepseek-chat",
      recentSessions: []
    });

    expect(palette.title).toBe("Switch Model");
    expect(palette.options.map((option) => option.label)).toEqual([
      "deepseek-chat",
      "deepseek-reasoner"
    ]);
  });

  it("shows permission actions for /permissions", () => {
    const palette = buildCommandPalette({
      input: "/permissions",
      currentModel: "deepseek-chat",
      recentSessions: []
    });

    expect(palette.options.map((option) => option.label)).toEqual([
      "show",
      "clear-session",
      "clear-workspace"
    ]);
  });

  it("shows recent sessions for /resume", () => {
    const palette = buildCommandPalette({
      input: "/resume",
      currentModel: "deepseek-chat",
      recentSessions: [
        {
          id: "session-1",
          workspaceRoot: "/tmp/project-a",
          model: "deepseek-chat",
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
          lastActiveAt: "2026-04-01T00:00:00.000Z",
          title: "Fix build",
          lastPrompt: "Please inspect build failures",
          messageCount: 4
        }
      ]
    });

    expect(palette.title).toBe("Resume Session");
    expect(palette.options[0]?.label).toBe("Fix build");
  });

  it("filters root commands by partial input", () => {
    const palette = buildCommandPalette({
      input: "/mo",
      currentModel: "deepseek-chat",
      recentSessions: []
    });

    expect(palette.options.map((option) => option.label)).toEqual(["/model"]);
  });
});
