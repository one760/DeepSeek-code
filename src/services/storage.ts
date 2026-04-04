import fs from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import type { HistoryEntry, RecentDiffPreview, Session, SessionSummary } from "../core/types.js";
import { getAppPaths, setAppPathsOverride } from "./paths.js";
import { isWindows } from "./platform.js";

async function withWritableAppPaths<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code !== "EPERM" && nodeError.code !== "EACCES") {
      throw error;
    }

    setAppPathsOverride(path.resolve(process.cwd(), ".deepseek-code"));
    await ensureAppDirectories();
    return operation();
  }
}

export async function ensureAppDirectories(): Promise<void> {
  const createDirectories = async (): Promise<void> => {
    const paths = getAppPaths();
    await Promise.all([
      fs.mkdir(paths.configDir, { recursive: true }),
      fs.mkdir(paths.dataDir, { recursive: true }),
      fs.mkdir(paths.logDir, { recursive: true }),
      fs.mkdir(paths.sessionsDir, { recursive: true }),
      fs.mkdir(paths.tempDir, { recursive: true }),
      fs.mkdir(paths.permissionsDir, { recursive: true }),
      fs.mkdir(paths.recentDiffsDir, { recursive: true })
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
  await withWritableAppPaths(async () => {
    const paths = getAppPaths();
    await fs.mkdir(path.dirname(paths.historyFile), { recursive: true });
    await fs.appendFile(paths.historyFile, `${JSON.stringify(entry)}\n`, "utf8");
  });
}

export async function saveSession(session: Session): Promise<void> {
  await withWritableAppPaths(async () => {
    const paths = getAppPaths();
    await fs.mkdir(paths.sessionsDir, { recursive: true });
    await writeJsonFile(path.join(paths.sessionsDir, `${session.id}.json`), enrichSession(session));
  });
}

export function createSession(workspaceRoot: string, model: string): Session {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    workspaceRoot,
    model,
    createdAt: now,
    updatedAt: now,
    lastActiveAt: now,
    title: "New conversation",
    lastPrompt: "",
    messageCount: 0,
    messages: []
  };
}

function truncate(text: string, maxLength = 80): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1)}…`;
}

function getLastUserPrompt(session: Session): string {
  const userMessage = [...session.messages].reverse().find((message) => message.role === "user");
  return userMessage ? truncate(userMessage.content, 120) : "";
}

function getSessionTitle(session: Session): string {
  const firstUserMessage = session.messages.find((message) => message.role === "user");
  return firstUserMessage ? truncate(firstUserMessage.content, 60) : "New conversation";
}

export function enrichSession(session: Session): Session {
  const lastMessageCreatedAt =
    [...session.messages].reverse().find((message) => message.createdAt)?.createdAt ?? session.updatedAt;

  return {
    ...session,
    title: getSessionTitle(session),
    lastPrompt: getLastUserPrompt(session),
    messageCount: session.messages.length,
    lastActiveAt: lastMessageCreatedAt
  };
}

export function summarizeSession(session: Session): SessionSummary {
  const enriched = enrichSession(session);
  return {
    id: enriched.id,
    workspaceRoot: enriched.workspaceRoot,
    model: enriched.model,
    createdAt: enriched.createdAt,
    updatedAt: enriched.updatedAt,
    lastActiveAt: enriched.lastActiveAt,
    title: enriched.title,
    lastPrompt: enriched.lastPrompt,
    messageCount: enriched.messageCount
  };
}

export async function loadSession(sessionId: string): Promise<Session | null> {
  const paths = getAppPaths();
  const session = await readJsonFile<Session | null>(
    path.join(paths.sessionsDir, `${sessionId}.json`),
    null
  );

  return session ? enrichSession(session) : null;
}

export async function listSessionSummaries(): Promise<SessionSummary[]> {
  const paths = getAppPaths();
  await fs.mkdir(paths.sessionsDir, { recursive: true });
  const entries = await fs.readdir(paths.sessionsDir, { withFileTypes: true });
  const summaries: SessionSummary[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) {
      continue;
    }

    try {
      const content = await fs.readFile(path.join(paths.sessionsDir, entry.name), "utf8");
      const session = JSON.parse(content) as Session;
      summaries.push(summarizeSession(session));
    } catch {
      continue;
    }
  }

  return summaries.sort((left, right) => {
    return new Date(right.lastActiveAt).getTime() - new Date(left.lastActiveAt).getTime();
  });
}

export function hashWorkspaceRoot(workspaceRoot: string): string {
  return createHash("sha256").update(path.resolve(workspaceRoot)).digest("hex").slice(0, 16);
}

export async function saveRecentDiffPreview(preview: RecentDiffPreview): Promise<void> {
  await withWritableAppPaths(async () => {
    const paths = getAppPaths();
    await fs.mkdir(paths.recentDiffsDir, { recursive: true });
    await writeJsonFile(path.join(paths.recentDiffsDir, `${preview.sessionId}.json`), preview);
  });
}

export async function loadRecentDiffPreview(sessionId: string): Promise<RecentDiffPreview | null> {
  const paths = getAppPaths();
  return readJsonFile<RecentDiffPreview | null>(
    path.join(paths.recentDiffsDir, `${sessionId}.json`),
    null
  );
}
