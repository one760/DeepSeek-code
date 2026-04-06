import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadStoredConfig, resolveConfig, saveStoredConfig, saveStoredLoggingConfig } from "../src/services/config.js";
import { clearAppPathsOverride, getAppPaths } from "../src/services/paths.js";

describe("resolveConfig", () => {
  const originalEnv = { ...process.env };
  let tempRoot = "";

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "deepseek-code-config-"));
    process.env.DEEPSEEK_CODE_HOME = tempRoot;
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.DEEPSEEK_BASE_URL;
    delete process.env.DEEPSEEK_MODEL;
  });

  afterEach(async () => {
    clearAppPathsOverride();
    process.env = { ...originalEnv };
    if (tempRoot) {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("prefers overrides over env and stored config", async () => {
    await saveStoredConfig({
      apiKey: "stored-key",
      baseUrl: "https://stored.example.com",
      model: "stored-model"
    });
    process.env.DEEPSEEK_API_KEY = "env-key";
    process.env.DEEPSEEK_BASE_URL = "https://env.example.com";
    process.env.DEEPSEEK_MODEL = "env-model";

    const resolved = await resolveConfig({
      apiKey: "override-key",
      baseUrl: "https://override.example.com",
      model: "override-model"
    });

    expect(resolved.apiKey).toBe("override-key");
    expect(resolved.baseUrl).toBe("https://override.example.com");
    expect(resolved.model).toBe("override-model");
    expect(resolved.sources).toEqual({
      apiKey: "override",
      baseUrl: "override",
      model: "override"
    });
  });

  it("falls back to defaults when nothing is configured", async () => {
    const resolved = await resolveConfig();
    const paths = getAppPaths();

    expect(resolved.apiKey).toBeUndefined();
    expect(resolved.baseUrl).toBe("https://api.deepseek.com");
    expect(resolved.model).toBe("deepseek-chat");
    expect(paths.configFile.startsWith(tempRoot)).toBe(true);
  });

  it("persists logging configuration alongside the rest of config", async () => {
    await saveStoredConfig({
      apiKey: "stored-key"
    });

    await saveStoredLoggingConfig({
      level: "debug",
      format: "json",
      enableColors: false
    });

    const stored = await loadStoredConfig();
    expect(stored.apiKey).toBe("stored-key");
    expect(stored.logging).toEqual({
      level: "debug",
      format: "json",
      enableColors: false
    });
  });
});
