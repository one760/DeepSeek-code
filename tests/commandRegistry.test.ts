import { describe, expect, it, vi } from "vitest";
import {
  createSlashCommandRegistry,
  executeRegisteredSlashCommand,
  getRootCommandPaletteOptions,
  parseSlashCommandInput
} from "../src/app/commandRegistry.js";

describe("command registry", () => {
  it("parses slash input into key and args", () => {
    expect(parseSlashCommandInput("/model deepseek-chat")).toEqual({
      key: "/model",
      args: ["deepseek-chat"]
    });
  });

  it("executes a registered command handler", async () => {
    const handler = vi.fn();
    const registry = createSlashCommandRegistry({
      help: vi.fn(),
      model: handler,
      resume: vi.fn(),
      permissions: vi.fn(),
      tools: vi.fn(),
      diff: vi.fn(),
      status: vi.fn(),
      usage: vi.fn(),
      clear: vi.fn(),
      quit: vi.fn()
    });

    const result = await executeRegisteredSlashCommand(registry, "/model reasoner");

    expect(result).toEqual({
      key: "/model",
      args: ["reasoner"],
      handled: true
    });
    expect(handler).toHaveBeenCalledWith(["reasoner"]);
  });

  it("exposes root palette metadata from the registry specs", () => {
    const options = getRootCommandPaletteOptions();
    expect(options.map((option) => option.label)).toContain("/permissions");
    expect(options.map((option) => option.label)).toContain("/usage");
    expect(options.map((option) => option.label)).toContain("/quit");
  });
});
