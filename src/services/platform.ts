import os from "node:os";
import path from "node:path";

export function getWorkspaceRoot(cwd = process.cwd()): string {
  return path.resolve(cwd);
}

export function isWindows(): boolean {
  return process.platform === "win32";
}

export function getPreferredShell(): { command: string; args: string[] } {
  if (isWindows()) {
    return {
      command: "pwsh",
      args: ["-NoLogo", "-NoProfile", "-Command"]
    };
  }

  const shell = process.env.SHELL || "/bin/sh";
  return {
    command: shell,
    args: ["-lc"]
  };
}

export function getHomeDirectory(): string {
  return os.homedir();
}
