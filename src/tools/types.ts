import type { z } from "zod";

export type JsonSchema = {
  type: string;
  description?: string;
  properties?: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
};

export type ToolResult = {
  success: boolean;
  output: string;
};

export type ToolExecutionContext = {
  workspaceRoot: string;
};

export type ToolDefinition<TInput> = {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  validator: z.ZodType<TInput>;
  isReadOnly: boolean;
  requiresConfirmation: (input: TInput, context: ToolExecutionContext) => boolean;
  getConfirmationMessage?: (input: TInput, context: ToolExecutionContext) => string;
  execute: (input: TInput, context: ToolExecutionContext) => Promise<ToolResult>;
};

export type ToolRegistry = Map<string, ToolDefinition<unknown>>;

export type ToolExecutionRecord = {
  toolName: string;
  input: unknown;
  confirmationRequired: boolean;
};
