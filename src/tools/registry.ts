import fg from "fast-glob";
import { z } from "zod";
import { buildEditPreview, buildWritePreview } from "../services/diffPreview.js";
import { isPathInsideWorkspace, readTextFile, replaceInFile, resolveWorkspacePath, writeTextFile } from "../services/fs.js";
import { getGitStatusSummary } from "../services/git.js";
import { runShellCommand } from "../services/shell.js";
import type { ToolDefinition, ToolRegistry, ToolResult } from "./types.js";

const readFileInput = z.object({
  path: z.string().min(1)
});

const globInput = z.object({
  pattern: z.string().min(1),
  cwd: z.string().optional()
});

const grepInput = z.object({
  pattern: z.string().min(1),
  cwd: z.string().optional(),
  glob: z.string().optional(),
  caseSensitive: z.boolean().optional(),
  maxResults: z.number().int().positive().max(200).optional()
});

const writeFileInput = z.object({
  path: z.string().min(1),
  content: z.string()
});

const editFileInput = z.object({
  path: z.string().min(1),
  oldText: z.string(),
  newText: z.string(),
  replaceAll: z.boolean().optional()
});

const execShellInput = z.object({
  command: z.string().min(1)
});

const gitStatusInput = z.object({});

function ok(output: string): ToolResult {
  return { success: true, output };
}

function fail(output: string): ToolResult {
  return { success: false, output };
}

function outsideWorkspaceRequiresConfirmation(pathValue: string, workspaceRoot: string): boolean {
  const resolved = resolveWorkspacePath(workspaceRoot, pathValue);
  return !isPathInsideWorkspace(workspaceRoot, resolved);
}

const readFileTool: ToolDefinition<z.infer<typeof readFileInput>> = {
  name: "read_file",
  description: "Read a UTF-8 text file from the workspace.",
  inputSchema: {
    type: "object",
    properties: {
      path: { type: "string", description: "Path to the file to read." }
    },
    required: ["path"],
    additionalProperties: false
  },
  validator: readFileInput,
  isReadOnly: true,
  requiresConfirmation: (input, context) =>
    outsideWorkspaceRequiresConfirmation(input.path, context.workspaceRoot),
  getConfirmationMessage: (input) => `Read file outside workspace: ${input.path}?`,
  execute: async (input, context) => {
    const targetPath = resolveWorkspacePath(context.workspaceRoot, input.path);
    const content = await readTextFile(targetPath);
    return ok(content);
  }
};

const globTool: ToolDefinition<z.infer<typeof globInput>> = {
  name: "glob",
  description: "List files matching a glob pattern.",
  inputSchema: {
    type: "object",
    properties: {
      pattern: { type: "string", description: "Glob pattern to match." },
      cwd: { type: "string", description: "Optional path relative to the workspace." }
    },
    required: ["pattern"],
    additionalProperties: false
  },
  validator: globInput,
  isReadOnly: true,
  requiresConfirmation: (input, context) =>
    input.cwd ? outsideWorkspaceRequiresConfirmation(input.cwd, context.workspaceRoot) : false,
  getConfirmationMessage: (input) => `Run glob outside workspace root via cwd=${input.cwd}?`,
  execute: async (input, context) => {
    const cwd = input.cwd
      ? resolveWorkspacePath(context.workspaceRoot, input.cwd)
      : context.workspaceRoot;
    const matches = await fg(input.pattern, {
      cwd,
      dot: true,
      onlyFiles: true
    });
    return ok(JSON.stringify(matches, null, 2));
  }
};

const grepTool: ToolDefinition<z.infer<typeof grepInput>> = {
  name: "grep",
  description: "Search file contents with a text or regex pattern.",
  inputSchema: {
    type: "object",
    properties: {
      pattern: { type: "string", description: "Pattern to search for." },
      cwd: { type: "string", description: "Optional search root path." },
      glob: { type: "string", description: "Optional file glob filter." },
      caseSensitive: { type: "boolean", description: "Whether the search is case-sensitive." },
      maxResults: { type: "number", description: "Maximum number of results." }
    },
    required: ["pattern"],
    additionalProperties: false
  },
  validator: grepInput,
  isReadOnly: true,
  requiresConfirmation: (input, context) =>
    input.cwd ? outsideWorkspaceRequiresConfirmation(input.cwd, context.workspaceRoot) : false,
  getConfirmationMessage: (input) => `Search outside workspace root via cwd=${input.cwd}?`,
  execute: async (input, context) => {
    const cwd = input.cwd
      ? resolveWorkspacePath(context.workspaceRoot, input.cwd)
      : context.workspaceRoot;
    const filePattern = input.glob ?? "**/*";
    const files = await fg(filePattern, {
      cwd,
      dot: true,
      onlyFiles: true,
      unique: true
    });
    const maxResults = input.maxResults ?? 50;
    const flags = input.caseSensitive ? "g" : "gi";
    const matcher = new RegExp(input.pattern, flags);
    const matches: Array<{ path: string; line: number; text: string }> = [];

    for (const file of files) {
      const absolutePath = resolveWorkspacePath(cwd, file);
      let content = "";

      try {
        content = await readTextFile(absolutePath);
      } catch {
        continue;
      }

      const lines = content.split(/\r?\n/);
      for (let index = 0; index < lines.length; index += 1) {
        if (!matcher.test(lines[index] ?? "")) {
          matcher.lastIndex = 0;
          continue;
        }

        matcher.lastIndex = 0;
        matches.push({
          path: file,
          line: index + 1,
          text: lines[index] ?? ""
        });

        if (matches.length >= maxResults) {
          return ok(JSON.stringify(matches, null, 2));
        }
      }
    }

    return ok(JSON.stringify(matches, null, 2));
  }
};

const writeFileTool: ToolDefinition<z.infer<typeof writeFileInput>> = {
  name: "write_file",
  description: "Write a full file with UTF-8 text.",
  inputSchema: {
    type: "object",
    properties: {
      path: { type: "string", description: "Path to the file to write." },
      content: { type: "string", description: "The content to write." }
    },
    required: ["path", "content"],
    additionalProperties: false
  },
  validator: writeFileInput,
  isReadOnly: false,
  requiresConfirmation: () => true,
  getConfirmationMessage: (input) => `Write file ${input.path}?`,
  buildPreview: async (input, context) =>
    buildWritePreview({
      workspaceRoot: context.workspaceRoot,
      path: input.path,
      content: input.content
    }),
  execute: async (input, context) => {
    const targetPath = resolveWorkspacePath(context.workspaceRoot, input.path);
    await writeTextFile(targetPath, input.content);
    return ok(`Wrote ${input.path}`);
  }
};

const editFileTool: ToolDefinition<z.infer<typeof editFileInput>> = {
  name: "edit_file",
  description: "Replace a text segment in a file.",
  inputSchema: {
    type: "object",
    properties: {
      path: { type: "string", description: "Path to the file to edit." },
      oldText: { type: "string", description: "Existing text to replace." },
      newText: { type: "string", description: "Replacement text." },
      replaceAll: { type: "boolean", description: "Replace all matches." }
    },
    required: ["path", "oldText", "newText"],
    additionalProperties: false
  },
  validator: editFileInput,
  isReadOnly: false,
  requiresConfirmation: () => true,
  getConfirmationMessage: (input) => `Edit file ${input.path}?`,
  buildPreview: async (input, context) =>
    buildEditPreview({
      workspaceRoot: context.workspaceRoot,
      path: input.path,
      oldText: input.oldText,
      newText: input.newText,
      replaceAll: input.replaceAll
    }),
  execute: async (input, context) => {
    const targetPath = resolveWorkspacePath(context.workspaceRoot, input.path);
    const result = await replaceInFile(targetPath, input.oldText, input.newText, input.replaceAll);
    if (!result.updated) {
      return fail(`No matching text found in ${input.path}`);
    }

    return ok(`Updated ${input.path} (${result.replacements} replacement${result.replacements === 1 ? "" : "s"})`);
  }
};

const execShellTool: ToolDefinition<z.infer<typeof execShellInput>> = {
  name: "exec_shell",
  description: "Run a shell command in the workspace.",
  inputSchema: {
    type: "object",
    properties: {
      command: { type: "string", description: "Shell command to execute." }
    },
    required: ["command"],
    additionalProperties: false
  },
  validator: execShellInput,
  isReadOnly: false,
  allowsWorkspacePermission: false,
  requiresConfirmation: () => true,
  getConfirmationMessage: (input) => `Run shell command?\n${input.command}`,
  execute: async (input, context) => {
    const result = await runShellCommand(input.command, context.workspaceRoot);
    return ok(
      JSON.stringify(
        {
          exitCode: result.exitCode,
          stdout: result.stdout,
          stderr: result.stderr
        },
        null,
        2
      )
    );
  }
};

const gitStatusTool: ToolDefinition<z.infer<typeof gitStatusInput>> = {
  name: "git_status",
  description: "Show git status for the current workspace.",
  inputSchema: {
    type: "object",
    properties: {},
    additionalProperties: false
  },
  validator: gitStatusInput,
  isReadOnly: true,
  requiresConfirmation: () => false,
  execute: async (_input, context) => {
    const summary = await getGitStatusSummary(context.workspaceRoot);
    return ok(JSON.stringify(summary, null, 2));
  }
};

export function createToolRegistry(): ToolRegistry {
  const tools: ToolDefinition<unknown>[] = [
    readFileTool,
    globTool,
    grepTool,
    writeFileTool,
    editFileTool,
    execShellTool,
    gitStatusTool
  ];

  return new Map(tools.map((tool) => [tool.name, tool]));
}

export function getToolDefinitions(): ToolDefinition<unknown>[] {
  return Array.from(createToolRegistry().values());
}
