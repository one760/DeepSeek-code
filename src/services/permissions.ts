import path from "node:path";
import type { PendingActionDecision, PermissionRule } from "../core/types.js";
import { getAppPaths } from "./paths.js";
import { hashWorkspaceRoot, readJsonFile, tightenFilePermissions, writeJsonFile } from "./storage.js";

export type SessionPermissionState = {
  allowedTools: Set<string>;
};

type StoredPermissionRules = {
  workspaceRoot: string;
  rules: PermissionRule[];
};

export function createSessionPermissionState(): SessionPermissionState {
  return {
    allowedTools: new Set<string>()
  };
}

function getPermissionFilePath(workspaceRoot: string): string {
  const paths = getAppPaths();
  return path.join(paths.permissionsDir, `${hashWorkspaceRoot(workspaceRoot)}.json`);
}

export async function loadWorkspacePermissionRules(workspaceRoot: string): Promise<PermissionRule[]> {
  const filePath = getPermissionFilePath(workspaceRoot);
  const stored = await readJsonFile<StoredPermissionRules | null>(filePath, null);
  if (!stored) {
    return [];
  }

  return stored.rules.filter((rule) => rule.scope === "workspace");
}

export async function saveWorkspacePermissionRules(
  workspaceRoot: string,
  rules: PermissionRule[]
): Promise<void> {
  const filePath = getPermissionFilePath(workspaceRoot);
  await writeJsonFile(filePath, {
    workspaceRoot,
    rules
  } satisfies StoredPermissionRules);
  await tightenFilePermissions(filePath);
}

export async function allowWorkspaceTool(workspaceRoot: string, toolName: string): Promise<void> {
  const rules = await loadWorkspacePermissionRules(workspaceRoot);
  if (rules.some((rule) => rule.toolName === toolName)) {
    return;
  }

  rules.push({
    toolName,
    scope: "workspace",
    createdAt: new Date().toISOString()
  });
  await saveWorkspacePermissionRules(workspaceRoot, rules);
}

export function allowSessionTool(state: SessionPermissionState, toolName: string): void {
  state.allowedTools.add(toolName);
}

export function getSessionPermissionRules(state: SessionPermissionState): PermissionRule[] {
  return Array.from(state.allowedTools.values())
    .sort((left, right) => left.localeCompare(right))
    .map((toolName) => ({
      toolName,
      scope: "session",
      createdAt: ""
    }));
}

export function clearSessionPermissionRules(state: SessionPermissionState): void {
  state.allowedTools.clear();
}

export async function clearWorkspacePermissionRules(workspaceRoot: string): Promise<void> {
  await saveWorkspacePermissionRules(workspaceRoot, []);
}

export async function resolvePermissionDecision(params: {
  workspaceRoot: string;
  toolName: string;
  sessionState?: SessionPermissionState;
}): Promise<Exclude<PendingActionDecision, "once" | "always"> | "always" | null> {
  const { workspaceRoot, toolName, sessionState } = params;
  if (sessionState?.allowedTools.has(toolName)) {
    return "session";
  }

  const workspaceRules = await loadWorkspacePermissionRules(workspaceRoot);
  if (workspaceRules.some((rule) => rule.toolName === toolName)) {
    return "always";
  }

  return null;
}
