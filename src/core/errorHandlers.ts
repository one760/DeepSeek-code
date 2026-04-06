/**
 * Deepseek Code CLI 错误处理工具
 *
 * 提供常用的错误处理模式和工具函数
 */

import { getLogger } from './logger.js';
import {
  DeepseekError,
  ApiError,
  AuthenticationError,
  ConfigurationError,
  FileSystemError,
  NetworkError,
  UserInputError,
  ToolExecutionError,
  SessionError,
  wrapError,
  formatErrorForDisplay,
  createRecoverySuggestions,
  isOperationalError,
  safeExecute,
  withRetry
} from './error.js';

// ==================== 错误工厂函数 ====================

/**
 * 创建API错误
 */
export function createApiError(
  message: string,
  statusCode?: number,
  apiEndpoint?: string,
  cause?: Error
): ApiError {
  return new ApiError(message, {
    cause,
    statusCode,
    apiEndpoint
  });
}

/**
 * 创建认证错误
 */
export function createAuthError(message: string, cause?: Error): AuthenticationError {
  return new AuthenticationError(message, { cause });
}

/**
 * 创建配置错误
 */
export function createConfigError(message: string, configKey?: string, cause?: Error): ConfigurationError {
  return new ConfigurationError(message, { cause, configKey });
}

/**
 * 创建文件系统错误
 */
export function createFsError(
  message: string,
  filePath?: string,
  operation?: string,
  cause?: Error
): FileSystemError {
  return new FileSystemError(message, { cause, filePath, operation });
}

/**
 * 创建网络错误
 */
export function createNetworkError(message: string, url?: string, cause?: Error): NetworkError {
  return new NetworkError(message, { cause, url });
}

/**
 * 创建用户输入错误
 */
export function createInputError(
  message: string,
  inputValue?: string,
  validationRule?: string,
  cause?: Error
): UserInputError {
  return new UserInputError(message, { cause, inputValue, validationRule });
}

/**
 * 创建工具执行错误
 */
export function createToolError(
  message: string,
  toolName?: string,
  toolArgs?: unknown,
  cause?: Error
): ToolExecutionError {
  return new ToolExecutionError(message, { cause, toolName, toolArgs });
}

/**
 * 创建会话错误
 */
export function createSessionError(message: string, sessionId?: string, cause?: Error): SessionError {
  return new SessionError(message, { cause, sessionId });
}

// ==================== 错误处理模式 ====================

/**
 * 处理API调用错误
 */
export async function handleApiCall<T>(
  apiCall: () => Promise<T>,
  context: {
    endpoint: string;
    operation: string;
    maxRetries?: number;
  }
): Promise<T> {
  const logger = getLogger();
  const { endpoint, operation, maxRetries = 3 } = context;

  const operationWithRetry = withRetry(apiCall, {
    maxRetries,
    shouldRetry: (error) => {
      // 只重试可操作错误和网络错误
      if (!isOperationalError(error)) {
        return false;
      }

      // 不重试客户端错误 (4xx)
      if (error instanceof ApiError && error.details?.statusCode) {
        const statusCode = error.details.statusCode as number;
        return statusCode >= 500 || statusCode === 429; // 服务器错误或限流
      }

      return true;
    },
    onRetry: (attempt, error) => {
      logger.warn(`API调用重试 (${attempt}/${maxRetries})`, {
        endpoint,
        operation,
        error: wrapError(error).toLogFormat()
      });
    }
  });

  try {
    return await operationWithRetry();
  } catch (error) {
    const wrappedError = wrapError(error);
    logger.error(`API调用失败: ${operation}`, {
      endpoint,
      error: wrappedError.toLogFormat()
    });
    throw wrappedError;
  }
}

/**
 * 处理文件操作错误
 */
export async function handleFileOperation<T>(
  operation: () => Promise<T>,
  context: {
    filePath: string;
    operation: string;
    fallback?: T;
  }
): Promise<T> {
  const logger = getLogger();
  const { filePath, operation: opName, fallback } = context;

  try {
    return await operation();
  } catch (error) {
    const wrappedError = wrapError(error);

    // 如果是文件不存在错误且提供了fallback，则返回fallback
    const nodeError = error as NodeJS.ErrnoException;
    if (
      wrappedError instanceof FileSystemError &&
      nodeError.code === 'ENOENT' &&
      fallback !== undefined
    ) {
      logger.debug(`文件不存在，使用默认值: ${filePath}`);
      return fallback;
    }

    logger.error(`文件操作失败: ${opName}`, {
      filePath,
      error: wrappedError.toLogFormat()
    });
    throw wrappedError;
  }
}

/**
 * 处理用户输入验证
 */
export function validateUserInput(
  value: string,
  rules: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
    customValidator?: (value: string) => boolean | string;
  }
): void {
  const { required = true, minLength, maxLength, pattern, customValidator } = rules;

  if (required && !value.trim()) {
    throw createInputError('输入不能为空', value, 'required');
  }

  if (minLength !== undefined && value.length < minLength) {
    throw createInputError(`输入长度不能少于 ${minLength} 个字符`, value, `minLength: ${minLength}`);
  }

  if (maxLength !== undefined && value.length > maxLength) {
    throw createInputError(`输入长度不能超过 ${maxLength} 个字符`, value, `maxLength: ${maxLength}`);
  }

  if (pattern && !pattern.test(value)) {
    throw createInputError(`输入格式无效`, value, `pattern: ${pattern}`);
  }

  if (customValidator) {
    const result = customValidator(value);
    if (result !== true) {
      const message = typeof result === 'string' ? result : '输入验证失败';
      throw createInputError(message, value, 'customValidator');
    }
  }
}

/**
 * 处理配置加载错误
 */
export async function handleConfigLoad<T>(
  loadOperation: () => Promise<T>,
  context: {
    configPath: string;
    defaultValue: T;
  }
): Promise<T> {
  const logger = getLogger();
  const { configPath, defaultValue } = context;

  return safeExecute(loadOperation, (error) => {
    if (error instanceof FileSystemError && error.details?.operation === 'read') {
      logger.debug(`配置文件不存在，使用默认值: ${configPath}`);
    } else {
      logger.warn(`配置文件加载失败，使用默认值: ${configPath}`, {
        error: error.toLogFormat()
      });
    }
  }) ?? defaultValue;
}

// ==================== UI错误处理 ====================

/**
 * 显示用户友好的错误消息
 */
export function displayUserFriendlyError(error: unknown): void {
  const wrappedError = wrapError(error);
  console.error(formatErrorForDisplay(wrappedError));
}

/**
 * 记录错误但不中断流程
 */
export function logErrorSilently(error: unknown, context?: Record<string, unknown>): void {
  const logger = getLogger();
  const wrappedError = wrapError(error);

  if (isOperationalError(wrappedError)) {
    logger.warn('操作错误', {
      ...context,
      error: wrappedError.toLogFormat()
    });
  } else {
    logger.error('非预期错误', {
      ...context,
      error: wrappedError.toLogFormat()
    });
  }
}

/**
 * 错误边界组件（用于React组件）
 * 注意：这个函数需要在React环境中使用
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: React.ReactNode
): React.ComponentType<P> {
  // 这是一个占位符实现，实际使用时需要React环境
  // 在非React环境中，直接返回原组件
  return Component;
}

// ==================== 错误恢复工具 ====================

/**
 * 尝试恢复操作
 */
export async function attemptRecovery<T>(
  operation: () => Promise<T>,
  recoveryStrategies: Array<{
    name: string;
    shouldAttempt: (error: DeepseekError) => boolean;
    attempt: () => Promise<void>;
  }>,
  maxAttempts = 2
): Promise<T> {
  let lastError: DeepseekError;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = wrapError(error);

      // 查找可用的恢复策略
      const applicableStrategies = recoveryStrategies.filter(strategy =>
        strategy.shouldAttempt(lastError)
      );

      if (applicableStrategies.length === 0) {
        break; // 没有可用的恢复策略
      }

      // 尝试每个恢复策略
      for (const strategy of applicableStrategies) {
        try {
          await strategy.attempt();
          break; // 恢复成功，跳出策略循环
        } catch (recoveryError) {
          logErrorSilently(recoveryError, { recoveryStrategy: strategy.name });
          // 继续尝试下一个策略
        }
      }
    }
  }

  throw lastError!;
}

/**
 * 创建默认恢复策略
 */
export function createDefaultRecoveryStrategies() {
  return [
    {
      name: 'retry_network',
      shouldAttempt: (error) =>
        error instanceof NetworkError || error.code === 'NETWORK_ERROR',
      attempt: async () => {
        // 简单的网络重试策略
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    },
    {
      name: 'clear_cache',
      shouldAttempt: (error) =>
        error instanceof FileSystemError && error.details?.operation === 'write',
      attempt: async () => {
        // 清理临时文件
        // 这里可以添加具体的缓存清理逻辑
      }
    }
  ];
}