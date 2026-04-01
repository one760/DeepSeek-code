import type { z } from "zod";
import type { PendingActionDecision } from "../core/types.js";

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
  sessionId?: string;
  sessionAllowedTools?: Set<string>;
};

export type PendingActionPreview = {
  targetLabel: string;
  preview: string;
  truncated: boolean;
};

export type PendingAction = {
  toolName: string;
  input: unknown;
  message: string;
  preview?: PendingActionPreview;
  allowedDecisions: PendingActionDecision[];
};

export type ToolDefinition<TInput> = {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  validator: z.ZodType<TInput>;
  isReadOnly: boolean;
  allowsWorkspacePermission?: boolean;
  requiresConfirmation: (input: TInput, context: ToolExecutionContext) => boolean;
  getConfirmationMessage?: (input: TInput, context: ToolExecutionContext) => string;
  buildPreview?: (
    input: TInput,
    context: ToolExecutionContext
  ) => Promise<PendingActionPreview | undefined>;
  execute: (input: TInput, context: ToolExecutionContext) => Promise<ToolResult>;
};

export type ToolRegistry = Map<string, ToolDefinition<unknown>>;

export type ToolExecutionRecord = {
  toolName: string;
  input: unknown;
  confirmationRequired: boolean;
};
