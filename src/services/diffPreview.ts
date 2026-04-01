import { readTextFile, resolveWorkspacePath } from "./fs.js";

export type DiffPreview = {
  targetLabel: string;
  preview: string;
  truncated: boolean;
};

type UnifiedDiffOptions = {
  maxLines?: number;
  maxChars?: number;
};

function splitLines(text: string): string[] {
  return text.length === 0 ? [] : text.split(/\r?\n/);
}

export function createUnifiedDiff(params: {
  pathLabel: string;
  beforeText: string;
  afterText: string;
  isNewFile?: boolean;
  options?: UnifiedDiffOptions;
}): DiffPreview {
  const { pathLabel, beforeText, afterText, isNewFile = false, options } = params;
  const beforeLines = splitLines(beforeText);
  const afterLines = splitLines(afterText);
  const maxLines = options?.maxLines ?? 120;
  const maxChars = options?.maxChars ?? 4000;

  let prefix = 0;
  while (
    prefix < beforeLines.length &&
    prefix < afterLines.length &&
    beforeLines[prefix] === afterLines[prefix]
  ) {
    prefix += 1;
  }

  let suffix = 0;
  while (
    suffix < beforeLines.length - prefix &&
    suffix < afterLines.length - prefix &&
    beforeLines[beforeLines.length - 1 - suffix] === afterLines[afterLines.length - 1 - suffix]
  ) {
    suffix += 1;
  }

  const removed = beforeLines.slice(prefix, beforeLines.length - suffix);
  const added = afterLines.slice(prefix, afterLines.length - suffix);
  const lines: string[] = [
    `--- ${isNewFile ? "/dev/null" : `a/${pathLabel}`}`,
    `+++ b/${pathLabel}`,
    `@@`
  ];

  for (const line of removed) {
    lines.push(`-${line}`);
  }

  for (const line of added) {
    lines.push(`+${line}`);
  }

  if (removed.length === 0 && added.length === 0) {
    lines.push("(no changes)");
  }

  let preview = lines.join("\n");
  let truncated = false;

  if (lines.length > maxLines) {
    preview = `${lines.slice(0, maxLines).join("\n")}\n...diff truncated...`;
    truncated = true;
  }

  if (preview.length > maxChars) {
    preview = `${preview.slice(0, maxChars)}\n...diff truncated...`;
    truncated = true;
  }

  return {
    targetLabel: pathLabel,
    preview,
    truncated
  };
}

export async function buildWritePreview(params: {
  workspaceRoot: string;
  path: string;
  content: string;
}): Promise<DiffPreview> {
  const { workspaceRoot, path, content } = params;
  const targetPath = resolveWorkspacePath(workspaceRoot, path);
  let beforeText = "";
  let isNewFile = false;

  try {
    beforeText = await readTextFile(targetPath);
  } catch {
    isNewFile = true;
  }

  return createUnifiedDiff({
    pathLabel: path,
    beforeText,
    afterText: content,
    isNewFile
  });
}

export async function buildEditPreview(params: {
  workspaceRoot: string;
  path: string;
  oldText: string;
  newText: string;
  replaceAll?: boolean;
}): Promise<DiffPreview> {
  const { workspaceRoot, path, oldText, newText, replaceAll = false } = params;
  const targetPath = resolveWorkspacePath(workspaceRoot, path);
  const beforeText = await readTextFile(targetPath);
  const afterText = replaceAll
    ? beforeText.split(oldText).join(newText)
    : beforeText.replace(oldText, newText);

  return createUnifiedDiff({
    pathLabel: path,
    beforeText,
    afterText
  });
}
