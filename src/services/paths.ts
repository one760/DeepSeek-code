import envPaths from "env-paths";
import path from "node:path";

export type AppPaths = {
  configDir: string;
  dataDir: string;
  logDir: string;
  tempDir: string;
  configFile: string;
  historyFile: string;
  sessionsDir: string;
};

let appPathsOverride: AppPaths | null = null;

function createPathsFromRoot(root: string): AppPaths {
  return {
    configDir: path.join(root, "config"),
    dataDir: path.join(root, "data"),
    logDir: path.join(root, "logs"),
    tempDir: path.join(root, "tmp"),
    configFile: path.join(root, "config", "config.json"),
    historyFile: path.join(root, "data", "history.jsonl"),
    sessionsDir: path.join(root, "data", "sessions")
  };
}

export function setAppPathsOverride(root: string): void {
  appPathsOverride = createPathsFromRoot(root);
}

export function clearAppPathsOverride(): void {
  appPathsOverride = null;
}

export function getAppPaths(): AppPaths {
  if (appPathsOverride) {
    return appPathsOverride;
  }

  if (process.env.DEEPSEEK_CODE_HOME) {
    return createPathsFromRoot(path.resolve(process.env.DEEPSEEK_CODE_HOME));
  }

  const paths = envPaths("deepseek-code", { suffix: "" });

  return {
    configDir: paths.config,
    dataDir: paths.data,
    logDir: paths.log,
    tempDir: paths.temp,
    configFile: path.join(paths.config, "config.json"),
    historyFile: path.join(paths.data, "history.jsonl"),
    sessionsDir: path.join(paths.data, "sessions")
  };
}
