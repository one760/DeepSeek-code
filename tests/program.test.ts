import { describe, expect, it, vi } from "vitest";
import { createProgram, type ProgramHandlers } from "../src/cli/program.js";

function createHandlers(): ProgramHandlers {
  return {
    interactive: vi.fn(async () => {}),
    login: vi.fn(async () => {}),
    logout: vi.fn(async () => {}),
    doctor: vi.fn(async () => {}),
    version: vi.fn(async () => {}),
    config: vi.fn(async () => {})
  };
}

describe("createProgram", () => {
  it("routes `deepseek code version` to the version handler", async () => {
    const handlers = createHandlers();
    const program = createProgram(handlers);

    await program.parseAsync(["code", "version"], { from: "user" });

    expect(handlers.version).toHaveBeenCalledOnce();
  });

  it("routes bare `deepseek code` to interactive mode", async () => {
    const handlers = createHandlers();
    const program = createProgram(handlers);

    await program.parseAsync(["code"], { from: "user" });

    expect(handlers.interactive).toHaveBeenCalledOnce();
  });
});
