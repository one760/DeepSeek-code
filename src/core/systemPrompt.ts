import { randomUUID } from "node:crypto";
import type { ConversationMessage } from "./types.js";
import type { ToolDefinition } from "../tools/types.js";

export type SystemPromptContext = {
  workspaceRoot: string;
  model: string;
  gitBranch?: string;
  projectInstructions?: string | null;
  tools?: ToolDefinition<unknown>[];
};

function listTools(tools: ToolDefinition<unknown>[] | undefined): string {
  if (!tools || tools.length === 0) {
    return "No tools are currently available.";
  }

  return tools
    .map((tool) => `- ${tool.name}: ${tool.description}`)
    .join("\n");
}

export function buildSystemPrompt(context: SystemPromptContext): string {
  const sections = [
    [
      "You are DeepSeek Code CLI, a pragmatic terminal coding assistant.",
      "Prioritize correct, minimal changes and explain actions clearly.",
      "Never claim you executed a tool or command unless it actually ran."
    ].join(" "),
    [
      `Workspace root: ${context.workspaceRoot}`,
      `Model: ${context.model}`,
      context.gitBranch ? `Git branch: ${context.gitBranch}` : null
    ]
      .filter(Boolean)
      .join("\n"),
    [
      "Working guidelines:",
      "- Prefer inspecting files before making edits.",
      "- Keep changes inside the workspace unless the user explicitly asks otherwise.",
      "- Use available tools when they reduce risk or improve accuracy."
    ].join("\n"),
    ["Available tools:", listTools(context.tools)].join("\n")
  ];

  if (context.projectInstructions?.trim()) {
    sections.push(
      [
        "Project instructions from .deepseek-code.md:",
        context.projectInstructions.trim()
      ].join("\n")
    );
  }

  return sections.join("\n\n");
}

export function createSystemMessage(
  context: SystemPromptContext
): ConversationMessage {
  return {
    id: randomUUID(),
    role: "system",
    content: buildSystemPrompt(context),
    createdAt: new Date().toISOString()
  };
}
