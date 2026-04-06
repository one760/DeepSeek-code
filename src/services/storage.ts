import fs from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import type { HistoryEntry, RecentDiffPreview, Session, SessionSummary } from "../core/types.js";
import { getAppPaths, setAppPathsOverride } from "./paths.js";
import { isWindows } from "./platform.js";
import { createFsError, handleFileOperation, logErrorSilently } from "../core/errorHandlers.js";
import { getLogger } from "../core/logger.js";

async function withWritableAppPaths<T>(operation: () => Promise<T>): Promise<T> {
  const logger = getLogger();

  try {
    return await operation();
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;

    // 只处理权限错误，其他错误直接抛出
    if (nodeError.code !== "EPERM" && nodeError.code !== "EACCES") {
      throw createFsError(
        `文件操作失败: ${nodeError.message}`,
        undefined,
        "write",
        nodeError
      );
    }

    logger.warn("检测到权限问题，尝试使用备用目录", {
      originalError: nodeError.message,
      code: nodeError.code
    });

    // 尝试使用当前目录下的备用目录
    const fallbackDir = path.resolve(process.cwd(), ".deepseek-code");
    setAppPathsOverride(fallbackDir);

    try {
      await ensureAppDirectories();
      return await operation();
    } catch (fallbackError) {
      throw createFsError(
        "无法创建或访问应用程序目录。请检查文件权限或磁盘空间。",
        fallbackDir,
        "create_directory",
        fallbackError as Error
      );
    }
  }
}

export async function ensureAppDirectories(): Promise<void> {
  const logger = getLogger();
  const createDirectories = async (): Promise<void> => {
    const paths = getAppPaths();
    logger.debug("创建应用程序目录", { paths });

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

    // 只处理权限错误，其他错误直接抛出
    if (nodeError.code !== "EPERM" && nodeError.code !== "EACCES") {
      throw createFsError(
        `创建目录失败: ${nodeError.message}`,
        undefined,
        "create_directory",
        nodeError
      );
    }

    logger.warn("主目录权限不足，尝试备用目录", {
      error: nodeError.message,
      code: nodeError.code
    });

    // 尝试使用当前目录下的备用目录
    const fallbackDir = path.resolve(process.cwd(), ".deepseek-code");
    setAppPathsOverride(fallbackDir);

    try {
      await createDirectories();
      logger.info("已使用备用目录", { fallbackDir });
    } catch (fallbackError) {
      const fallbackNodeError = fallbackError as NodeJS.ErrnoException;
      throw createFsError(
        `无法创建应用程序目录。请检查权限和磁盘空间。`,
        fallbackDir,
        "create_directory",
        fallbackNodeError
      );
    }
  }
}

export async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  return handleFileOperation(
    async () => {
      const content = await fs.readFile(filePath, "utf8");
      return JSON.parse(content) as T;
    },
    {
      filePath,
      operation: "read",
      fallback
    }
  );
}

export async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  const logger = getLogger();

  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
    logger.debug("文件写入成功", { filePath });
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    throw createFsError(
      `写入文件失败: ${nodeError.message}`,
      filePath,
      "write",
      nodeError
    );
  }
}

export async function tightenFilePermissions(filePath: string): Promise<void> {
  if (isWindows()) {
    return;
  }

  try {
    await fs.access(filePath, fsConstants.F_OK);
    await fs.chmod(filePath, 0o600);
  } catch (error) {
    // 静默处理权限调整失败，不影响主要功能
    logErrorSilently(error, { filePath, operation: "tighten_permissions" });
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
