import type { LogLevel, LoggerOptions } from '../core/logger.js';
import { loadStoredConfig } from './config.js';

export interface LogConfig {
  level?: LogLevel;
  format?: 'json' | 'text';
  enableColors?: boolean;
  file?: {
    enabled: boolean;
    path?: string;
    maxSize?: number;
    maxFiles?: number;
  };
}

export async function loadLogConfig(): Promise<LogConfig> {
  try {
    const config = await loadStoredConfig();
    return config.logging || {};
  } catch {
    return {};
  }
}

export function getLogLevelFromEnv(): LogLevel | undefined {
  const envLevel = process.env.DEEPSEEK_LOG_LEVEL?.toLowerCase();

  if (envLevel === 'debug' || envLevel === 'info' || envLevel === 'warn' || envLevel === 'error') {
    return envLevel as LogLevel;
  }

  return undefined;
}

export function getLogFormatFromEnv(): 'json' | 'text' | undefined {
  const envFormat = process.env.DEEPSEEK_LOG_FORMAT?.toLowerCase();

  if (envFormat === 'json' || envFormat === 'text') {
    return envFormat;
  }

  return undefined;
}

export function shouldEnableColors(): boolean {
  // Enable colors by default for TTY, disable for non-TTY (e.g., pipes, files)
  if (process.stdout.isTTY === false) {
    return false;
  }

  // Check for NO_COLOR environment variable (standard)
  if (process.env.NO_COLOR) {
    return false;
  }

  // Check for FORCE_COLOR environment variable
  if (process.env.FORCE_COLOR === '0') {
    return false;
  }

  if (process.env.FORCE_COLOR === '1' || process.env.FORCE_COLOR === '2' || process.env.FORCE_COLOR === '3') {
    return true;
  }

  return true;
}

export async function resolveLoggerOptions(): Promise<LoggerOptions> {
  const config = await loadLogConfig();
  const envLevel = getLogLevelFromEnv();
  const envFormat = getLogFormatFromEnv();

  return {
    level: envLevel || config.level || 'info',
    format: envFormat || config.format || 'text',
    enableColors: config.enableColors ?? shouldEnableColors(),
    includeTimestamp: true,
    includeContext: true
  };
}

export function initializeLogger(): void {
  import('../core/logger.js').then(async ({ configureLogger, getLogger }) => {
    const options = await resolveLoggerOptions();
    configureLogger(options);

    // Log successful initialization
    const logger = getLogger();
    logger.debug('Logger initialized successfully', { options });
  }).catch(error => {
    // Fallback logging when logger initialization fails
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] ERROR: Failed to initialize logger: ${error.message}`;
    console.error(logLine);

    if (error.stack) {
      console.error(`Stack: ${error.stack}`);
    }
  });
}
