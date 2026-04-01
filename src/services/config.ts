import fs from "node:fs/promises";
import type { ResolvedConfig, RuntimeOverrides, StoredConfig } from "../core/types.js";
import { getAppPaths } from "./paths.js";
import { ensureAppDirectories, readJsonFile, tightenFilePermissions, writeJsonFile } from "./storage.js";

export const DEFAULT_BASE_URL = "https://api.deepseek.com";
export const DEFAULT_MODEL = "deepseek-chat";

export async function loadStoredConfig(): Promise<StoredConfig> {
  const paths = getAppPaths();
  return readJsonFile(paths.configFile, {});
}

export async function saveStoredConfig(nextConfig: StoredConfig): Promise<void> {
  const paths = getAppPaths();
  await ensureAppDirectories();
  await writeJsonFile(paths.configFile, nextConfig);
  await tightenFilePermissions(paths.configFile);
}

export async function setStoredApiKey(apiKey: string): Promise<void> {
  const current = await loadStoredConfig();
  await saveStoredConfig({
    ...current,
    apiKey
  });
}

export async function clearStoredApiKey(): Promise<void> {
  const current = await loadStoredConfig();
  const next = { ...current };
  delete next.apiKey;
  await saveStoredConfig(next);
}

export async function resolveConfig(overrides: RuntimeOverrides = {}): Promise<ResolvedConfig> {
  const stored = await loadStoredConfig();

  const apiKey = overrides.apiKey ?? process.env.DEEPSEEK_API_KEY ?? stored.apiKey;
  const baseUrl = overrides.baseUrl ?? process.env.DEEPSEEK_BASE_URL ?? stored.baseUrl ?? DEFAULT_BASE_URL;
  const model = overrides.model ?? process.env.DEEPSEEK_MODEL ?? stored.model ?? DEFAULT_MODEL;

  return {
    apiKey,
    baseUrl,
    model,
    sources: {
      apiKey: overrides.apiKey ? "override" : process.env.DEEPSEEK_API_KEY ? "env" : stored.apiKey ? "config" : "default",
      baseUrl: overrides.baseUrl ? "override" : process.env.DEEPSEEK_BASE_URL ? "env" : stored.baseUrl ? "config" : "default",
      model: overrides.model ? "override" : process.env.DEEPSEEK_MODEL ? "env" : stored.model ? "config" : "default"
    }
  };
}

export async function getConfigView(overrides: RuntimeOverrides = {}): Promise<{
  resolved: ResolvedConfig;
  paths: ReturnType<typeof getAppPaths>;
}> {
  await ensureAppDirectories();
  return {
    resolved: await resolveConfig(overrides),
    paths: getAppPaths()
  };
}

export async function hasStoredConfig(): Promise<boolean> {
  const paths = getAppPaths();

  try {
    await fs.access(paths.configFile);
    return true;
  } catch {
    return false;
  }
}
