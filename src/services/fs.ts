import fs from "node:fs/promises";
import path from "node:path";

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

export async function replaceInFile(
  filePath: string,
  oldText: string,
  newText: string,
  replaceAll = false
): Promise<{ updated: boolean; replacements: number }> {
  const content = await readTextFile(filePath);

  if (!content.includes(oldText)) {
    return { updated: false, replacements: 0 };
  }

  const updatedContent = replaceAll
    ? content.split(oldText).join(newText)
    : content.replace(oldText, newText);
  const replacements = replaceAll ? content.split(oldText).length - 1 : 1;

  await writeTextFile(filePath, updatedContent);

  return {
    updated: true,
    replacements
  };
}
