import { Command } from "commander";
import readline from "node:readline/promises";
import process from "node:process";
import { Writable } from "node:stream";
import { APP_VERSION } from "../meta.js";
import { runInteractiveApp } from "../app/runInteractiveApp.js";
import { clearStoredApiKey, getConfigView, resolveConfig, saveStoredLoggingConfig, setStoredApiKey } from "../services/config.js";
import { ensureAppDirectories } from "../services/storage.js";
import { getWorkspaceRoot } from "../services/platform.js";
import { getGitStatusSummary } from "../services/git.js";
import { checkNetworkConnectivity } from "../services/network.js";
import { configureLogger, getLogger } from "../core/logger.js";
import { createAuthError, createInputError, displayUserFriendlyError } from "../core/errorHandlers.js";
import { resolveLoggerOptions } from "../services/loggerConfig.js";

export type ProgramHandlers = {
  interactive: () => Promise<void>;
  login: (apiKey?: string) => Promise<void>;
  logout: () => Promise<void>;
  doctor: () => Promise<void>;
  version: () => Promise<void>;
  config: () => Promise<void>;
  logLevel: (level: string) => Promise<void>;
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
      const logger = getLogger();
      try {
        const apiKey = providedApiKey || (await promptForApiKey());
        if (!apiKey) {
          throw createAuthError("API密钥是必需的。请提供有效的DeepSeek API密钥。");
        }

        await setStoredApiKey(apiKey);
        logger.debug("API key saved");
        console.log("API key saved.");
      } catch (error) {
        displayUserFriendlyError(error);
        throw error;
      }
    },
    logout: async () => {
      const logger = getLogger();
      await clearStoredApiKey();
      logger.debug("Stored API key removed");
      console.log("Stored API key removed.");
    },
    doctor: async () => {
      const logger = getLogger();
      logger.debug("Running doctor command");

      await ensureAppDirectories();
      const config = await resolveConfig();
      const git = await getGitStatusSummary(getWorkspaceRoot());
      const network = await checkNetworkConnectivity(config.baseUrl);

      const doctorInfo = {
        node: process.version,
        workspaceRoot: getWorkspaceRoot(),
        apiKeyConfigured: Boolean(config.apiKey),
        baseUrl: config.baseUrl,
        model: config.model,
        network,
        git
      };

      logger.debug("Doctor check completed", { doctorInfo });
      console.log(JSON.stringify(doctorInfo, null, 2));
    },
    version: async () => {
      const logger = getLogger();
      logger.debug("Showing version", { version: APP_VERSION });
      console.log(APP_VERSION);
    },
    config: async () => {
      const logger = getLogger();
      logger.debug("Showing configuration");

      const view = await getConfigView();
      const configOutput = {
        paths: view.paths,
        resolved: {
          ...view.resolved,
          apiKey: view.resolved.apiKey ? "***redacted***" : undefined
        }
      };

      logger.debug("Configuration retrieved", { config: configOutput });
      console.log(JSON.stringify(configOutput, null, 2));
    },
    logLevel: async (level: string) => {
      try {
        const validLevels = ['debug', 'info', 'warn', 'error'];
        const normalizedLevel = level.toLowerCase();

        if (!validLevels.includes(normalizedLevel)) {
          throw createInputError(
            `无效的日志级别: ${level}`,
            level,
            `必须是以下值之一: ${validLevels.join(', ')}`
          );
        }

        await saveStoredLoggingConfig({
          level: normalizedLevel as "debug" | "info" | "warn" | "error"
        });

        configureLogger({
          ...(await resolveLoggerOptions()),
          level: normalizedLevel as "debug" | "info" | "warn" | "error"
        });

        const logger = getLogger();
        logger.debug("Log level updated", { newLevel: normalizedLevel });
        console.log(`日志级别已设置为: ${normalizedLevel}`);
      } catch (error) {
        displayUserFriendlyError(error);
        throw error;
      }
    }
  };
}

export function createProgram(handlers: ProgramHandlers = createDefaultHandlers()): Command {
  const program = new Command("deepseek");
  program.description("Deepseek CLI");

  // Global options for logging
  program
    .option("--log-level <level>", "Set log level (debug, info, warn, error)")
    .option("--log-format <format>", "Set log format (json, text)")
    .option("--no-colors", "Disable colored output")
    .hook("preAction", async (thisCommand) => {
      const options = thisCommand.opts();
      const loggerOptions: Parameters<typeof configureLogger>[0] = {};

      if (thisCommand.getOptionValueSource("logLevel") !== "default") {
        loggerOptions.level = options.logLevel as "debug" | "info" | "warn" | "error";
      }

      if (thisCommand.getOptionValueSource("logFormat") !== "default") {
        loggerOptions.format = options.logFormat as "json" | "text";
      }

      if (thisCommand.getOptionValueSource("colors") !== "default") {
        loggerOptions.enableColors = options.colors as boolean;
      }

      if (Object.keys(loggerOptions).length > 0) {
        configureLogger({
          ...(await resolveLoggerOptions()),
          ...loggerOptions
        });
      }
    });

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

  code
    .command("log-level <level>")
    .description("Set log level (debug, info, warn, error)")
    .action(async (level: string) => {
      await handlers.logLevel(level);
    });

  program.addCommand(code);
  return program;
}

export async function runCli(argv = process.argv): Promise<void> {
  configureLogger(await resolveLoggerOptions());
  const program = createProgram();
  await program.parseAsync(argv);
}
