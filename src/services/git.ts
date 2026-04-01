import { runShellCommand } from "./shell.js";

export type GitStatusSummary = {
  available: boolean;
  insideWorkTree: boolean;
  branch?: string;
  status?: string;
  diffStat?: string;
  error?: string;
};

export async function getGitStatusSummary(workspaceRoot: string): Promise<GitStatusSummary> {
  const version = await runShellCommand("git --version", workspaceRoot);
  if (version.exitCode !== 0) {
    return {
      available: false,
      insideWorkTree: false,
      error: version.stderr || "git is not available"
    };
  }

  const inside = await runShellCommand("git rev-parse --is-inside-work-tree", workspaceRoot);
  if (inside.exitCode !== 0 || inside.stdout !== "true") {
    return {
      available: true,
      insideWorkTree: false
    };
  }

  const status = await runShellCommand("git status --short --branch", workspaceRoot);
  const branchMatch = status.stdout.match(/^##\s+([^\n. ]+)/m);
  const diffStat = await runShellCommand("git diff --stat", workspaceRoot);

  return {
    available: true,
    insideWorkTree: true,
    branch: branchMatch?.[1],
    status: status.stdout,
    diffStat: diffStat.stdout
  };
}
