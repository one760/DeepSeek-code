import fs from "node:fs/promises";
import path from "node:path";

export type DirectoryEntryInfo = {
  path: string;
  type: "file" | "directory" | "other";
  size: number;
  modifiedAt: string;
};

export function resolveWorkspacePath(workspaceRoot: string, filePath: string): string {
  return path.isAbsolute(filePath)
    ? path.normalize(filePath)
    : path.resolve(workspaceRoot, filePath);
}

export function isPathInsideWorkspace(workspaceRoot: string, targetPath: string): boolean {
  const root = path.resolve(workspaceRoot);
  const target = path.resolve(targetPath);
  return target === root || target.startsWith(`${root}${path.sep}`);
}

export async function ensureParentDirectory(filePath: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

export async function readTextFile(filePath: string): Promise<string> {
  return fs.readFile(filePath, "utf8");
}

export async function writeTextFile(filePath: string, content: string): Promise<void> {
  await ensureParentDirectory(filePath);
  await fs.writeFile(filePath, content, "utf8");
}

function buildSearchPattern(
  oldText: string,
  replaceAll: boolean,
  useRegex: boolean
): RegExp | null {
  if (!useRegex) {
    return null;
  }

  return new RegExp(oldText, replaceAll ? "g" : "");
}

export async function replaceInFile(
  filePath: string,
  oldText: string,
  newText: string,
  replaceAll = false,
  useRegex = false
): Promise<{ updated: boolean; replacements: number }> {
  const content = await readTextFile(filePath);
  const pattern = buildSearchPattern(oldText, replaceAll, useRegex);

  if (!pattern && !content.includes(oldText)) {
    return { updated: false, replacements: 0 };
  }

  if (pattern) {
    let replacements = 0;
    const updatedContent = content.replace(pattern, (...args) => {
      replacements += 1;
      const matchGroups = args.slice(1, -2);
      return newText.replace(/\$(\d+)/g, (_fullMatch, indexValue: string) => {
        const matchIndex = Number.parseInt(indexValue, 10) - 1;
        return String(matchGroups[matchIndex] ?? "");
      });
    });

    if (replacements === 0) {
      return { updated: false, replacements: 0 };
    }

    await writeTextFile(filePath, updatedContent);

    return {
      updated: true,
      replacements
    };
  }

  const replacements = replaceAll ? content.split(oldText).length - 1 : 1;
  const updatedContent = replaceAll
    ? content.split(oldText).join(newText)
    : content.replace(oldText, newText);

  await writeTextFile(filePath, updatedContent);

  return {
    updated: true,
    replacements
  };
}

export async function listDirectory(
  rootPath: string,
  options: {
    recursive?: boolean;
    maxDepth?: number;
    maxEntries?: number;
  } = {}
): Promise<DirectoryEntryInfo[]> {
  const recursive = options.recursive ?? false;
  const maxDepth = options.maxDepth ?? (recursive ? 4 : 1);
  const maxEntries = options.maxEntries ?? 200;
  const entries: DirectoryEntryInfo[] = [];

  async function walk(currentPath: string, currentDepth: number): Promise<void> {
    if (entries.length >= maxEntries || currentDepth > maxDepth) {
      return;
    }

    const children = await fs.readdir(currentPath, { withFileTypes: true });
    for (const child of children) {
      if (entries.length >= maxEntries) {
        return;
      }

      const absolutePath = path.join(currentPath, child.name);
      const stats = await fs.stat(absolutePath);
      const relativePath = path.relative(rootPath, absolutePath) || ".";
      const type = child.isFile()
        ? "file"
        : child.isDirectory()
          ? "directory"
          : "other";

      entries.push({
        path: relativePath,
        type,
        size: stats.size,
        modifiedAt: stats.mtime.toISOString()
      });

      if (recursive && child.isDirectory()) {
        await walk(absolutePath, currentDepth + 1);
      }
    }
  }

  await walk(rootPath, 1);

  return entries;
}
