import fs from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { HistoryEntry, Session } from "../core/types.js";
import { getAppPaths, setAppPathsOverride } from "./paths.js";
import { isWindows } from "./platform.js";

export async function ensureAppDirectories(): Promise<void> {
  const createDirectories = async (): Promise<void> => {
    const paths = getAppPaths();
    await Promise.all([
      fs.mkdir(paths.configDir, { recursive: true }),
      fs.mkdir(paths.dataDir, { recursive: true }),
      fs.mkdir(paths.logDir, { recursive: true }),
      fs.mkdir(paths.sessionsDir, { recursive: true }),
      fs.mkdir(paths.tempDir, { recursive: true })
    ]);
  };

  try {
    await createDirectories();
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code !== "EPERM" && nodeError.code !== "EACCES") {
      throw error;
    }

    setAppPathsOverride(path.resolve(process.cwd(), ".deepseek-code"));
    await createDirectories();
  }
}

export async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const content = await fs.readFile(filePath, "utf8");
    return JSON.parse(content) as T;
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return fallback;
    }

    throw error;
  }
}

export async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}

export async function tightenFilePermissions(filePath: string): Promise<void> {
  if (isWindows()) {
    return;
  }

  try {
    await fs.access(filePath, fsConstants.F_OK);
    await fs.chmod(filePath, 0o600);
  } catch {
    return;
  }
}

export async function appendHistoryLine(entry: HistoryEntry): Promise<void> {
  const paths = getAppPaths();
  await fs.mkdir(path.dirname(paths.historyFile), { recursive: true });
  await fs.appendFile(paths.historyFile, `${JSON.stringify(entry)}\n`, "utf8");
}

export async function saveSession(session: Session): Promise<void> {
  const paths = getAppPaths();
  await fs.mkdir(paths.sessionsDir, { recursive: true });
  await writeJsonFile(path.join(paths.sessionsDir, `${session.id}.json`), session);
}

export function createSession(workspaceRoot: string, model: string): Session {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    workspaceRoot,
    model,
    createdAt: now,
    updatedAt: now,
    messages: []
  };
}
