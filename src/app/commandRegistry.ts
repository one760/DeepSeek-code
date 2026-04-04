import type { CommandPaletteAction, CommandPaletteOption } from "./types.js";

export type SlashCommandName =
  | "help"
  | "model"
  | "resume"
  | "permissions"
  | "tools"
  | "diff"
  | "status"
  | "usage"
  | "clear"
  | "quit";

export type SlashCommandHandler = (args: string[]) => Promise<void> | void;

export type SlashCommandSpec = {
  name: SlashCommandName;
  description: string;
  paletteAction: CommandPaletteAction;
};

export type SlashCommandRegistry = Map<string, SlashCommandHandler>;

export type ParsedSlashCommand = {
  key: string;
  args: string[];
};

export type SlashCommandExecutionResult = ParsedSlashCommand & {
  handled: boolean;
};

export const SLASH_COMMAND_SPECS: SlashCommandSpec[] = [
  {
    name: "help",
    description: "Show command help",
    paletteAction: { type: "command", command: "help" }
  },
  {
    name: "model",
    description: "Switch between available models",
    paletteAction: { type: "submenu", submenu: "model" }
  },
  {
    name: "resume",
    description: "Resume a recent conversation",
    paletteAction: { type: "submenu", submenu: "resume" }
  },
  {
    name: "permissions",
    description: "Inspect or clear permission rules",
    paletteAction: { type: "submenu", submenu: "permissions" }
  },
  {
    name: "tools",
    description: "Show tool availability",
    paletteAction: { type: "command", command: "tools" }
  },
  {
    name: "diff",
    description: "Show the latest diff preview",
    paletteAction: { type: "command", command: "diff" }
  },
  {
    name: "status",
    description: "Show current session details",
    paletteAction: { type: "command", command: "status" }
  },
  {
    name: "usage",
    description: "Show cumulative token and cost usage",
    paletteAction: { type: "command", command: "usage" }
  },
  {
    name: "clear",
    description: "Clear the current conversation",
    paletteAction: { type: "command", command: "clear" }
  },
  {
    name: "quit",
    description: "Exit the application",
    paletteAction: { type: "command", command: "quit" }
  }
];

export function createSlashCommandRegistry(
  handlers: Record<SlashCommandName, SlashCommandHandler>
): SlashCommandRegistry {
  return new Map(
    SLASH_COMMAND_SPECS.map((spec) => [`/${spec.name}`, handlers[spec.name]])
  );
}

export function parseSlashCommandInput(input: string): ParsedSlashCommand {
  const [command, ...args] = input.trim().split(/\s+/);
  return {
    key: command,
    args
  };
}

export async function executeRegisteredSlashCommand(
  registry: SlashCommandRegistry,
  input: string
): Promise<SlashCommandExecutionResult> {
  const parsed = parseSlashCommandInput(input);
  const handler = registry.get(parsed.key);
  if (!handler) {
    return {
      ...parsed,
      handled: false
    };
  }

  await handler(parsed.args);
  return {
    ...parsed,
    handled: true
  };
}

export function getRootCommandPaletteOptions(): CommandPaletteOption[] {
  return SLASH_COMMAND_SPECS.map((spec) => ({
    id: spec.name,
    label: `/${spec.name}`,
    description: spec.description,
    action: spec.paletteAction
  }));
}
