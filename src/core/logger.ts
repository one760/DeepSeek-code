export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  error?: Error;
}

export interface LoggerOptions {
  level?: LogLevel;
  format?: 'json' | 'text';
  enableColors?: boolean;
  includeTimestamp?: boolean;
  includeContext?: boolean;
}

export interface LoggerTransport {
  write(entry: LogEntry): void;
}

export class ConsoleTransport implements LoggerTransport {
  private readonly enableColors: boolean;
  private readonly format: 'json' | 'text';

  constructor(options: { enableColors?: boolean; format?: 'json' | 'text' } = {}) {
    this.enableColors = options.enableColors ?? true;
    this.format = options.format ?? 'text';
  }

  write(entry: LogEntry): void {
    if (this.format === 'json') {
      console.error(JSON.stringify(entry));
      return;
    }

    const timestamp = entry.timestamp;
    const level = entry.level.toUpperCase();
    const message = entry.message;

    let logLine = `[${timestamp}] ${level}: ${message}`;

    if (entry.context && Object.keys(entry.context).length > 0) {
      logLine += ` ${JSON.stringify(entry.context)}`;
    }

    if (entry.error) {
      logLine += `\nError: ${entry.error.message}`;
      if (entry.error.stack) {
        logLine += `\nStack: ${entry.error.stack}`;
      }
    }

    if (this.enableColors) {
      const colors = {
        debug: '\x1b[36m', // Cyan
        info: '\x1b[32m',  // Green
        warn: '\x1b[33m',  // Yellow
        error: '\x1b[31m', // Red
        reset: '\x1b[0m'   // Reset
      };

      const color = colors[entry.level] || colors.reset;
      console.error(`${color}${logLine}${colors.reset}`);
    } else {
      console.error(logLine);
    }
  }
}

export class Logger {
  private readonly level: LogLevel;
  private readonly transports: LoggerTransport[];
  private readonly includeTimestamp: boolean;
  private readonly includeContext: boolean;

  constructor(options: LoggerOptions = {}) {
    this.level = options.level || 'info';
    this.includeTimestamp = options.includeTimestamp ?? true;
    this.includeContext = options.includeContext ?? true;

    this.transports = [
      new ConsoleTransport({
        enableColors: options.enableColors,
        format: options.format
      })
    ];
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };

    return levels[level] >= levels[this.level];
  }

  private createEntry(level: LogLevel, message: string, context?: Record<string, unknown>, error?: Error): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(this.includeContext && context ? { context } : {}),
      ...(error ? { error } : {})
    };
  }

  debug(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog('debug')) {
      const entry = this.createEntry('debug', message, context);
      this.transports.forEach(transport => transport.write(entry));
    }
  }

  info(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog('info')) {
      const entry = this.createEntry('info', message, context);
      this.transports.forEach(transport => transport.write(entry));
    }
  }

  warn(message: string, context?: Record<string, unknown>, error?: Error): void {
    if (this.shouldLog('warn')) {
      const entry = this.createEntry('warn', message, context, error);
      this.transports.forEach(transport => transport.write(entry));
    }
  }

  error(message: string, context?: Record<string, unknown>, error?: Error): void {
    if (this.shouldLog('error')) {
      const entry = this.createEntry('error', message, context, error);
      this.transports.forEach(transport => transport.write(entry));
    }
  }

  addTransport(transport: LoggerTransport): void {
    this.transports.push(transport);
  }

  child(context: Record<string, unknown>): Logger {
    const childLogger = new Logger({
      level: this.level,
      includeTimestamp: this.includeTimestamp,
      includeContext: this.includeContext
    });

    // Override the createEntry method to include parent context
    const originalCreateEntry = childLogger.createEntry.bind(childLogger);
    childLogger.createEntry = (level: LogLevel, message: string, childContext?: Record<string, unknown>, error?: Error) => {
      const mergedContext = { ...context, ...childContext };
      return originalCreateEntry(level, message, mergedContext, error);
    };

    return childLogger;
  }
}

// Default logger instance
let defaultLogger: Logger | null = null;

export function getLogger(): Logger {
  if (!defaultLogger) {
    defaultLogger = new Logger();
  }
  return defaultLogger;
}

export function setLogger(logger: Logger): void {
  defaultLogger = logger;
}

export function configureLogger(options: LoggerOptions): Logger {
  const logger = new Logger(options);
  setLogger(logger);
  return logger;
}
