import { Command } from "commander";
import readline from "node:readline/promises";
import process from "node:process";
import { Writable } from "node:stream";
import { APP_VERSION } from "../meta.js";
import { runInteractiveApp } from "../app/runInteractiveApp.js";
import { clearStoredApiKey, getConfigView, resolveConfig, setStoredApiKey } from "../services/config.js";
import { ensureAppDirectories } from "../services/storage.js";
import { getWorkspaceRoot } from "../services/platform.js";
import { getGitStatusSummary } from "../services/git.js";
import { checkNetworkConnectivity } from "../services/network.js";

export type ProgramHandlers = {
  interactive: () => Promise<void>;
  login: (apiKey?: string) => Promise<void>;
  logout: () => Promise<void>;
  doctor: () => Promise<void>;
  version: () => Promise<void>;
  config: () => Promise<void>;
};

async function promptForApiKey(): Promise<string> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    const apiKey = await rl.question("DeepSeek API Key: ");
    rl.close();
    return apiKey.trim();
  }

  let muted = true;
  const silentOutput = new Writable({
    write(chunk, encoding, callback) {
      const text = chunk.toString();

      if (!muted) {
        process.stdout.write(text, encoding as BufferEncoding);
      } else if (text.includes("\n")) {
        process.stdout.write("\n");
      }

      callback();
    }
  });
  const rl = readline.createInterface({
    input: process.stdin,
    output: silentOutput,
    terminal: true
  });
  process.stdout.write("DeepSeek API Key: ");

  try {
    const apiKey = await rl.question("");
    process.stdout.write("\n");
    return apiKey.trim();
  } finally {
    muted = false;
    rl.close();
  }
}

export function createDefaultHandlers(): ProgramHandlers {
  return {
    interactive: runInteractiveApp,
    login: async (providedApiKey?: string) => {
      const apiKey = providedApiKey || (await promptForApiKey());
      if (!apiKey) {
        throw new Error("API key is required.");
      }

      await setStoredApiKey(apiKey);
      console.log("API key saved.");
    },
    logout: async () => {
      await clearStoredApiKey();
      console.log("Stored API key removed.");
    },
    doctor: async () => {
      await ensureAppDirectories();
      const config = await resolveConfig();
      const git = await getGitStatusSummary(getWorkspaceRoot());
      const network = await checkNetworkConnectivity(config.baseUrl);

      console.log(
        JSON.stringify(
          {
            node: process.version,
            workspaceRoot: getWorkspaceRoot(),
            apiKeyConfigured: Boolean(config.apiKey),
            baseUrl: config.baseUrl,
            model: config.model,
            network,
            git
          },
          null,
          2
        )
      );
    },
    version: async () => {
      console.log(APP_VERSION);
    },
    config: async () => {
      const view = await getConfigView();
      console.log(
        JSON.stringify(
          {
            paths: view.paths,
            resolved: {
              ...view.resolved,
              apiKey: view.resolved.apiKey ? "***redacted***" : undefined
            }
          },
          null,
          2
        )
      );
    }
  };
}

export function createProgram(handlers: ProgramHandlers = createDefaultHandlers()): Command {
  const program = new Command("deepseek");
  program.description("Deepseek CLI");

  const code = new Command("code").description("Deepseek Code interactive CLI");
  code.action(async () => {
    await handlers.interactive();
  });
  code
    .command("login")
    .description("Save a DeepSeek API key")
    .option("-k, --api-key <apiKey>", "API key to persist")
    .action(async (options: { apiKey?: string }) => {
      await handlers.login(options.apiKey);
    });
  code
    .command("logout")
    .description("Remove the stored DeepSeek API key")
    .action(async () => {
      await handlers.logout();
    });
  code
    .command("doctor")
    .description("Inspect local configuration and environment")
    .action(async () => {
      await handlers.doctor();
    });
  code
    .command("version")
    .description("Print the CLI version")
    .action(async () => {
      await handlers.version();
    });
  code
    .command("config")
    .description("Show effective configuration")
    .action(async () => {
      await handlers.config();
    });

  program.addCommand(code);
  return program;
}

export async function runCli(argv = process.argv): Promise<void> {
  const program = createProgram();
  await program.parseAsync(argv);
}
