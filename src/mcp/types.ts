import type { JsonSchema, ToolDefinition, ToolResult } from "../tools/types.js";

export type McpToolDefinition = {
  name: string;
  description: string;
  inputSchema: JsonSchema;
};

export type McpServerConfig = {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
};

export type McpClient = {
  listTools(): Promise<McpToolDefinition[]>;
  callTool(name: string, input: unknown): Promise<ToolResult>;
};

export type ToolRegistryLike = Map<string, ToolDefinition<unknown>>;
