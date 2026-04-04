import fs from "node:fs/promises";
import path from "node:path";
import type { McpServerConfig } from "./types.js";

export const MCP_CONFIG_FILENAME = ".deepseek-code-mcp.json";

export async function loadMcpConfig(
  workspaceRoot: string
): Promise<McpServerConfig[] | null> {
  const filePath = path.join(workspaceRoot, MCP_CONFIG_FILENAME);

  try {
    const content = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(content) as { servers?: McpServerConfig[] } | McpServerConfig[];
    if (Array.isArray(parsed)) {
      return parsed;
    }

    return parsed.servers ?? [];
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}
