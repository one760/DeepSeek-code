/**
 * Deepseek Code CLI 错误处理模块
 *
 * 提供统一的错误类层次结构和错误处理工具
 */

// ==================== 基础错误类 ====================

/**
 * Deepseek Code CLI 基础错误类
 */
export class DeepseekError extends Error {
  public readonly code: string;
  public readonly details?: Record<string, unknown>;
  public readonly isOperational: boolean;
  public readonly timestamp: Date;

  constructor(
    message: string,
    code: string,
    options: {
      cause?: Error;
      details?: Record<string, unknown>;
      isOperational?: boolean;
    } = {}
  ) {
    super(message);
    this.name = 'DeepseekError';
    this.code = code;
    this.details = options.details;
    this.isOperational = options.isOperational ?? true;
    this.timestamp = new Date();

    if (options.cause) {
      this.cause = options.cause;
    }

    // 保持正确的原型链
    Object.setPrototypeOf(this, DeepseekError.prototype);
  }

  /**
   * 转换为用户友好的错误消息
   */
  toUserMessage(): string {
    return `[${this.code}] ${this.message}`;
  }

  /**
   * 转换为日志格式
   */
  toLogFormat(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      isOperational: this.isOperational,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack,
      cause: this.cause
    };
  }
}

// ==================== 具体错误类型 ====================

/**
 * API 相关错误
 */
export class ApiError extends DeepseekError {
  constructor(
    message: string,
    options: {
      cause?: Error;
      details?: Record<string, unknown>;
      statusCode?: number;
      apiEndpoint?: string;
    } = {}
  ) {
    const code = options.statusCode
      ? `API_${options.statusCode}`
      : 'API_ERROR';

    super(message, code, {
      cause: options.cause,
      details: {
        ...options.details,
        statusCode: options.statusCode,
        apiEndpoint: options.apiEndpoint
      },
      isOperational: true
    });
    this.name = 'ApiError';

    // 保持正确的原型链
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

/**
 * 认证错误
 */
export class AuthenticationError extends DeepseekError {
  constructor(
    message: string,
    options: {
      cause?: Error;
      details?: Record<string, unknown>;
    } = {}
  ) {
    super(message, 'AUTH_ERROR', {
      cause: options.cause,
      details: options.details,
      isOperational: true
    });
    this.name = 'AuthenticationError';

    // 保持正确的原型链
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

/**
 * 配置错误
 */
export class ConfigurationError extends DeepseekError {
  constructor(
    message: string,
    options: {
      cause?: Error;
      details?: Record<string, unknown>;
      configKey?: string;
    } = {}
  ) {
    super(message, 'CONFIG_ERROR', {
      cause: options.cause,
      details: {
        ...options.details,
        configKey: options.configKey
      },
      isOperational: true
    });
    this.name = 'ConfigurationError';

    // 保持正确的原型链
    Object.setPrototypeOf(this, ConfigurationError.prototype);
  }
}

/**
 * 文件系统错误
 */
export class FileSystemError extends DeepseekError {
  constructor(
    message: string,
    options: {
      cause?: Error;
      details?: Record<string, unknown>;
      filePath?: string;
      operation?: string;
    } = {}
  ) {
    super(message, 'FS_ERROR', {
      cause: options.cause,
      details: {
        ...options.details,
        filePath: options.filePath,
        operation: options.operation
      },
      isOperational: true
    });
    this.name = 'FileSystemError';

    // 保持正确的原型链
    Object.setPrototypeOf(this, FileSystemError.prototype);
  }
}

/**
 * 网络错误
 */
export class NetworkError extends DeepseekError {
  constructor(
    message: string,
    options: {
      cause?: Error;
      details?: Record<string, unknown>;
      url?: string;
    } = {}
  ) {
    super(message, 'NETWORK_ERROR', {
      cause: options.cause,
      details: {
        ...options.details,
        url: options.url
      },
      isOperational: true
    });
    this.name = 'NetworkError';

    // 保持正确的原型链
    Object.setPrototypeOf(this, NetworkError.prototype);
  }
}

/**
 * 用户输入错误
 */
export class UserInputError extends DeepseekError {
  constructor(
    message: string,
    options: {
      cause?: Error;
      details?: Record<string, unknown>;
      inputValue?: string;
      validationRule?: string;
    } = {}
  ) {
    super(message, 'INPUT_ERROR', {
      cause: options.cause,
      details: {
        ...options.details,
        inputValue: options.inputValue,
        validationRule: options.validationRule
      },
      isOperational: true
    });
    this.name = 'UserInputError';

    // 保持正确的原型链
    Object.setPrototypeOf(this, UserInputError.prototype);
  }
}

/**
 * 工具执行错误
 */
export class ToolExecutionError extends DeepseekError {
  constructor(
    message: string,
    options: {
      cause?: Error;
      details?: Record<string, unknown>;
      toolName?: string;
      toolArgs?: unknown;
    } = {}
  ) {
    super(message, 'TOOL_ERROR', {
      cause: options.cause,
      details: {
        ...options.details,
        toolName: options.toolName,
        toolArgs: options.toolArgs
      },
      isOperational: true
    });
    this.name = 'ToolExecutionError';

    // 保持正确的原型链
    Object.setPrototypeOf(this, ToolExecutionError.prototype);
  }
}

/**
 * 会话错误
 */
export class SessionError extends DeepseekError {
  constructor(
    message: string,
    options: {
      cause?: Error;
      details?: Record<string, unknown>;
      sessionId?: string;
    } = {}
  ) {
    super(message, 'SESSION_ERROR', {
      cause: options.cause,
      details: {
        ...options.details,
        sessionId: options.sessionId
      },
      isOperational: true
    });
    this.name = 'SessionError';

    // 保持正确的原型链
    Object.setPrototypeOf(this, SessionError.prototype);
  }
}

// ==================== 错误处理工具函数 ====================

/**
 * 判断错误是否为可操作错误
 */
export function isOperationalError(error: unknown): boolean {
  if (error instanceof DeepseekError) {
    return error.isOperational;
  }
  return false;
}

/**
 * 安全地执行函数，捕获并包装错误
 */
export async function safeExecute<T>(
  operation: () => Promise<T>,
  errorHandler?: (error: DeepseekError) => void
): Promise<T | undefined> {
  try {
    return await operation();
  } catch (error) {
    const wrappedError = wrapError(error);
    if (errorHandler) {
      errorHandler(wrappedError);
    }
    return undefined;
  }
}

/**
 * 包装原生错误为 DeepseekError
 */
export function wrapError(error: unknown): DeepseekError {
  if (error instanceof DeepseekError) {
    return error;
  }

  if (error instanceof Error) {
    // 根据错误消息或类型判断错误类别
    const message = error.message;

    // 检查网络相关错误
    if (
      error.message.includes('network') ||
      error.message.includes('fetch') ||
      error.message.includes('timeout') ||
      error.name === 'FetchError' ||
      error.message.includes('ECONN') ||
      error.message.includes('ENOTFOUND')
    ) {
      return new NetworkError(message, { cause: error });
    }

    // 检查文件系统错误
    if (
      error.message.includes('ENOENT') ||
      error.message.includes('EACCES') ||
      error.message.includes('EPERM') ||
      error.message.includes('file') ||
      error.message.includes('directory')
    ) {
      return new FileSystemError(message, { cause: error });
    }

    // 检查API错误
    if (
      error.message.includes('API') ||
      error.message.includes('status') ||
      error.message.includes('response')
    ) {
      return new ApiError(message, { cause: error });
    }

    // 默认包装为通用错误
    return new DeepseekError(message, 'UNKNOWN_ERROR', {
      cause: error,
      isOperational: false
    });
  }

  // 非Error对象
  return new DeepseekError(
    typeof error === 'string' ? error : 'Unknown error occurred',
    'UNKNOWN_ERROR',
    { isOperational: false }
  );
}

/**
 * 创建带重试逻辑的函数
 */
export function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number;
    retryDelay?: number;
    shouldRetry?: (error: unknown) => boolean;
    onRetry?: (attempt: number, error: unknown) => void;
  } = {}
): () => Promise<T> {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    shouldRetry = (error) => isOperationalError(error),
    onRetry
  } = options;

  return async () => {
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        // 如果是最后一次尝试或者不应该重试，则抛出错误
        if (attempt === maxRetries || !shouldRetry(error)) {
          throw wrapError(error);
        }

        // 调用重试回调
        if (onRetry) {
          onRetry(attempt + 1, error);
        }

        // 等待一段时间后重试（使用指数退避）
        if (attempt < maxRetries) {
          const delay = retryDelay * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // 理论上不会执行到这里，但为了类型安全
    throw wrapError(lastError!);
  };
}

/**
 * 创建错误恢复建议
 */
export function createRecoverySuggestions(error: DeepseekError): string[] {
  const suggestions: string[] = [];

  switch (error.code) {
    case 'AUTH_ERROR':
      suggestions.push('运行 `deepseek code login` 重新登录');
      suggestions.push('检查您的API密钥是否有效');
      suggestions.push('确认您有访问DeepSeek API的权限');
      break;

    case 'API_ERROR':
    case 'NETWORK_ERROR':
      suggestions.push('检查网络连接');
      suggestions.push('确认API端点可访问');
      suggestions.push('稍后重试');
      break;

    case 'CONFIG_ERROR':
      suggestions.push('检查配置文件格式');
      suggestions.push('运行 `deepseek code doctor` 诊断配置问题');
      suggestions.push('删除配置文件后重新配置');
      break;

    case 'FS_ERROR':
      suggestions.push('检查文件/目录权限');
      suggestions.push('确认磁盘空间充足');
      suggestions.push('尝试使用不同的工作目录');
      break;

    case 'INPUT_ERROR':
      suggestions.push('检查输入格式');
      suggestions.push('参考帮助文档获取正确格式');
      break;

    case 'TOOL_ERROR':
      suggestions.push('检查工具参数');
      suggestions.push('确认有执行该操作的权限');
      break;

    default:
      suggestions.push('查看日志获取详细信息');
      suggestions.push('运行 `deepseek code doctor` 诊断问题');
      suggestions.push('重启应用程序');
  }

  return suggestions;
}

/**
 * 格式化错误显示
 */
export function formatErrorForDisplay(error: DeepseekError): string {
  const suggestions = createRecoverySuggestions(error);

  let output = `❌ ${error.toUserMessage()}\n\n`;

  if (error.details && Object.keys(error.details).length > 0) {
    output += '详细信息:\n';
    for (const [key, value] of Object.entries(error.details)) {
      output += `  ${key}: ${JSON.stringify(value)}\n`;
    }
    output += '\n';
  }

  if (suggestions.length > 0) {
    output += '建议的解决方法:\n';
    suggestions.forEach((suggestion, index) => {
      output += `  ${index + 1}. ${suggestion}\n`;
    });
  }

  return output;
}

/**
 * 错误处理中间件
 */
export function createErrorMiddleware() {
  return {
    onError: (error: unknown) => {
      const wrappedError = wrapError(error);
      console.error(formatErrorForDisplay(wrappedError));
      return wrappedError;
    }
  };
}