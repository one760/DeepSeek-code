import type { PendingActionDecision, RecentDiffPreview } from "../core/types.js";
import { allowWorkspaceTool, resolvePermissionDecision } from "../services/permissions.js";
import { saveRecentDiffPreview } from "../services/storage.js";
import type { ToolCall } from "../core/types.js";
import type { PendingAction, ToolDefinition, ToolExecutionContext, ToolResult } from "./types.js";
import { getLogger } from "../core/logger.js";

export type ConfirmationHandler = (request: PendingAction) => Promise<PendingActionDecision>;

export type ToolRunEvent =
  | { type: "tool-preview"; toolName: string; preview: string; targetLabel: string; truncated: boolean }
  | { type: "tool-start"; toolName: string; input: unknown; confirmationRequired: boolean }
  | { type: "tool-decision"; toolName: string; decision: PendingActionDecision }
  | { type: "tool-end"; toolName: string; result: ToolResult };

export type ToolMessageResult = {
  toolCallId: string;
  toolName: string;
  output: string;
  success: boolean;
};

type ToolBatch = {
  isConcurrent: boolean;
  calls: ToolCall[];
};

function partitionToolCalls(
  toolCalls: ToolCall[],
  definitions: Map<string, ToolDefinition<unknown>>
): ToolBatch[] {
  const batches: ToolBatch[] = [];

  for (const call of toolCalls) {
    const tool = definitions.get(call.name);
    const isConcurrent = Boolean(tool?.isReadOnly);
    const lastBatch = batches.at(-1);

    if (isConcurrent && lastBatch?.isConcurrent) {
      lastBatch.calls.push(call);
      continue;
    }

    batches.push({
      isConcurrent,
      calls: [call]
    });
  }

  return batches;
}

async function executeSingleTool(
  toolCall: ToolCall,
  definitions: Map<string, ToolDefinition<unknown>>,
  context: ToolExecutionContext,
  confirm: ConfirmationHandler,
  onEvent?: (event: ToolRunEvent) => void
): Promise<ToolMessageResult> {
  const logger = getLogger();
  const definition = definitions.get(toolCall.name);
  if (!definition) {
    logger.error('Tool not found', { toolName: toolCall.name });
    return {
      toolCallId: toolCall.id,
      toolName: toolCall.name,
      output: `Unknown tool: ${toolCall.name}`,
      success: false
    };
  }

  logger.debug('Starting tool execution', {
    toolName: definition.name,
    toolCallId: toolCall.id,
    workspaceRoot: context.workspaceRoot
  });

  const parsed = definition.validator.safeParse(toolCall.input);
  if (!parsed.success) {
    logger.warn('Tool input validation failed', {
      toolName: definition.name,
      error: parsed.error.message
    });
    return {
      toolCallId: toolCall.id,
      toolName: toolCall.name,
      output: parsed.error.message,
      success: false
    };
  }

  const confirmationRequired = definition.requiresConfirmation(parsed.data, context);
  const preview = await definition.buildPreview?.(parsed.data, context);
  if (preview && context.sessionId) {
    const recentPreview: RecentDiffPreview = {
      sessionId: context.sessionId,
      toolName: definition.name,
      targetLabel: preview.targetLabel,
      preview: preview.preview,
      createdAt: new Date().toISOString(),
      truncated: preview.truncated
    };
    await saveRecentDiffPreview(recentPreview);
  }
  const autoPermission = confirmationRequired
    ? await resolvePermissionDecision({
        workspaceRoot: context.workspaceRoot,
        toolName: definition.name,
        sessionState: context.sessionAllowedTools
          ? { allowedTools: context.sessionAllowedTools }
          : undefined
      })
    : null;

  onEvent?.({
    type: "tool-start",
    toolName: definition.name,
    input: parsed.data,
    confirmationRequired: confirmationRequired && autoPermission === null
  });

  if (confirmationRequired && autoPermission === null) {
    if (preview) {
      onEvent?.({
        type: "tool-preview",
        toolName: definition.name,
        preview: preview.preview,
        targetLabel: preview.targetLabel,
        truncated: preview.truncated
      });
    }

    const message =
      definition.getConfirmationMessage?.(parsed.data, context) ??
      `Allow tool ${definition.name}?`;
    const decision = await confirm({
      toolName: definition.name,
      input: parsed.data,
      message,
      preview,
      allowedDecisions: definition.allowsWorkspacePermission === false
        ? ["once", "session", "deny"]
        : ["once", "session", "always", "deny"]
    });
    onEvent?.({ type: "tool-decision", toolName: definition.name, decision });

    if (decision === "deny") {
      const deniedResult = {
        success: false,
        output: `Tool ${definition.name} denied by user.`
      };
      onEvent?.({ type: "tool-end", toolName: definition.name, result: deniedResult });
      return {
        toolCallId: toolCall.id,
        toolName: definition.name,
        output: deniedResult.output,
        success: false
      };
    }

    if (decision === "session" && context.sessionAllowedTools) {
      context.sessionAllowedTools.add(definition.name);
    }

    if (decision === "always" && definition.allowsWorkspacePermission !== false) {
      await allowWorkspaceTool(context.workspaceRoot, definition.name);
    }
  } else if (autoPermission) {
    onEvent?.({ type: "tool-decision", toolName: definition.name, decision: autoPermission });
  }

  const result = await definition.execute(parsed.data, context);
  onEvent?.({ type: "tool-end", toolName: definition.name, result });

  logger.debug('Tool execution completed', {
    toolName: definition.name,
    success: result.success,
    toolCallId: toolCall.id
  });

  return {
    toolCallId: toolCall.id,
    toolName: definition.name,
    output: result.output,
    success: result.success
  };
}

export async function executeToolCalls(
  toolCalls: ToolCall[],
  definitions: Map<string, ToolDefinition<unknown>>,
  context: ToolExecutionContext,
  confirm: ConfirmationHandler,
  onEvent?: (event: ToolRunEvent) => void
): Promise<ToolMessageResult[]> {
  const logger = getLogger();

  logger.debug('Starting batch tool execution', {
    toolCallCount: toolCalls.length,
    workspaceRoot: context.workspaceRoot
  });
  const results: ToolMessageResult[] = [];
  const batches = partitionToolCalls(toolCalls, definitions);

  for (const batch of batches) {
    if (batch.isConcurrent) {
      const batchResults = await Promise.all(
        batch.calls.map((call) =>
          executeSingleTool(call, definitions, context, confirm, onEvent)
        )
      );
      results.push(...batchResults);
      continue;
    }

    for (const call of batch.calls) {
      results.push(
        await executeSingleTool(call, definitions, context, confirm, onEvent)
      );
    }
  }

  const successCount = results.filter(r => r.success).length;
  logger.debug('Batch tool execution completed', {
    totalTools: results.length,
    successfulTools: successCount,
    failedTools: results.length - successCount
  });

  return results;
}
