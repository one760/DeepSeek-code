import type { ToolCall } from "../core/types.js";
import type { ToolDefinition, ToolExecutionContext, ToolResult } from "./types.js";

export type ConfirmationHandler = (message: string) => Promise<boolean>;

export type ToolRunEvent =
  | { type: "tool-start"; toolName: string; input: unknown; confirmationRequired: boolean }
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
  const definition = definitions.get(toolCall.name);
  if (!definition) {
    return {
      toolCallId: toolCall.id,
      toolName: toolCall.name,
      output: `Unknown tool: ${toolCall.name}`,
      success: false
    };
  }

  const parsed = definition.validator.safeParse(toolCall.input);
  if (!parsed.success) {
    return {
      toolCallId: toolCall.id,
      toolName: toolCall.name,
      output: parsed.error.message,
      success: false
    };
  }

  const confirmationRequired = definition.requiresConfirmation(parsed.data, context);
  onEvent?.({
    type: "tool-start",
    toolName: definition.name,
    input: parsed.data,
    confirmationRequired
  });

  if (confirmationRequired) {
    const message =
      definition.getConfirmationMessage?.(parsed.data, context) ??
      `Allow tool ${definition.name}?`;
    const approved = await confirm(message);

    if (!approved) {
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
  }

  const result = await definition.execute(parsed.data, context);
  onEvent?.({ type: "tool-end", toolName: definition.name, result });

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

  return results;
}
