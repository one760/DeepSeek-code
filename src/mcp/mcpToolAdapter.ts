import { z } from "zod";
import type { ToolDefinition } from "../tools/types.js";
import type { McpClient, McpToolDefinition, ToolRegistryLike } from "./types.js";

export function mcpToolToDefinition(
  tool: McpToolDefinition,
  client: McpClient
): ToolDefinition<unknown> {
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    validator: z.unknown(),
    isReadOnly: false,
    requiresConfirmation: () => true,
    getConfirmationMessage: () => `Run MCP tool ${tool.name}?`,
    execute: async (input) => client.callTool(tool.name, input)
  };
}

export function mergeToolRegistries(
  builtinRegistry: ToolRegistryLike,
  mcpTools: ToolDefinition<unknown>[]
): ToolRegistryLike {
  const merged = new Map(builtinRegistry);

  for (const tool of mcpTools) {
    merged.set(tool.name, tool);
  }

  return merged;
}
