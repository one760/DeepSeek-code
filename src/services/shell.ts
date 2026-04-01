import { spawn } from "node:child_process";
import type { SpawnOptionsWithoutStdio } from "node:child_process";
import { getPreferredShell } from "./platform.js";

export type ShellResult = {
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
};

export async function runShellCommand(
  command: string,
  cwd: string,
  options: SpawnOptionsWithoutStdio = {}
): Promise<ShellResult> {
  const shell = getPreferredShell();

  return new Promise((resolve, reject) => {
    const child = spawn(shell.command, [...shell.args, command], {
      cwd,
      env: process.env,
      ...options
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });

    child.stderr?.on("data", (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (exitCode) => {
      resolve({
        command,
        stdout: stdout.trimEnd(),
        stderr: stderr.trimEnd(),
        exitCode
      });
    });
  });
}
