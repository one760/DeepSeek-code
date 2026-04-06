import { describe, it, expect, vi, beforeEach } from 'vitest';
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
  isOperationalError,
  safeExecute,
  withRetry,
  createRecoverySuggestions,
  formatErrorForDisplay
} from '../src/core/error.js';

describe('错误处理模块', () => {
  describe('基础错误类', () => {
    it('应该创建DeepseekError实例', () => {
      const error = new DeepseekError('测试错误', 'TEST_ERROR');

      expect(error).toBeInstanceOf(DeepseekError);
      expect(error.message).toBe('测试错误');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.isOperational).toBe(true);
      expect(error.timestamp).toBeInstanceOf(Date);
    });

    it('应该包含原因和详细信息', () => {
      const cause = new Error('原始错误');
      const details = { key: 'value' };
      const error = new DeepseekError('测试错误', 'TEST_ERROR', {
        cause,
        details,
        isOperational: false
      });

      expect(error.cause).toBe(cause);
      expect(error.details).toEqual(details);
      expect(error.isOperational).toBe(false);
    });

    it('应该生成用户友好的消息', () => {
      const error = new DeepseekError('测试错误', 'TEST_ERROR');
      expect(error.toUserMessage()).toBe('[TEST_ERROR] 测试错误');
    });

    it('应该转换为日志格式', () => {
      const error = new DeepseekError('测试错误', 'TEST_ERROR', {
        details: { foo: 'bar' }
      });
      const logFormat = error.toLogFormat();

      expect(logFormat.name).toBe('DeepseekError');
      expect(logFormat.code).toBe('TEST_ERROR');
      expect(logFormat.message).toBe('测试错误');
      expect(logFormat.details).toEqual({ foo: 'bar' });
      expect(logFormat.isOperational).toBe(true);
      expect(logFormat.timestamp).toBeDefined();
    });
  });

  describe('具体错误类型', () => {
    it('应该创建ApiError', () => {
      const error = new ApiError('API调用失败', {
        statusCode: 500,
        apiEndpoint: 'https://api.example.com'
      });

      expect(error).toBeInstanceOf(ApiError);
      expect(error).toBeInstanceOf(DeepseekError);
      expect(error.code).toBe('API_500');
      expect(error.details?.statusCode).toBe(500);
      expect(error.details?.apiEndpoint).toBe('https://api.example.com');
    });

    it('应该创建AuthenticationError', () => {
      const error = new AuthenticationError('认证失败');
      expect(error).toBeInstanceOf(AuthenticationError);
      expect(error.code).toBe('AUTH_ERROR');
    });

    it('应该创建ConfigurationError', () => {
      const error = new ConfigurationError('配置错误', {
        configKey: 'apiKey'
      });
      expect(error).toBeInstanceOf(ConfigurationError);
      expect(error.code).toBe('CONFIG_ERROR');
      expect(error.details?.configKey).toBe('apiKey');
    });

    it('应该创建FileSystemError', () => {
      const error = new FileSystemError('文件操作失败', {
        filePath: '/path/to/file',
        operation: 'read'
      });
      expect(error).toBeInstanceOf(FileSystemError);
      expect(error.code).toBe('FS_ERROR');
      expect(error.details?.filePath).toBe('/path/to/file');
      expect(error.details?.operation).toBe('read');
    });

    it('应该创建NetworkError', () => {
      const error = new NetworkError('网络连接失败', {
        url: 'https://api.example.com'
      });
      expect(error).toBeInstanceOf(NetworkError);
      expect(error.code).toBe('NETWORK_ERROR');
      expect(error.details?.url).toBe('https://api.example.com');
    });

    it('应该创建UserInputError', () => {
      const error = new UserInputError('输入无效', {
        inputValue: 'invalid',
        validationRule: 'required'
      });
      expect(error).toBeInstanceOf(UserInputError);
      expect(error.code).toBe('INPUT_ERROR');
      expect(error.details?.inputValue).toBe('invalid');
      expect(error.details?.validationRule).toBe('required');
    });

    it('应该创建ToolExecutionError', () => {
      const error = new ToolExecutionError('工具执行失败', {
        toolName: 'readFile',
        toolArgs: { path: '/file.txt' }
      });
      expect(error).toBeInstanceOf(ToolExecutionError);
      expect(error.code).toBe('TOOL_ERROR');
      expect(error.details?.toolName).toBe('readFile');
      expect(error.details?.toolArgs).toEqual({ path: '/file.txt' });
    });

    it('应该创建SessionError', () => {
      const error = new SessionError('会话错误', {
        sessionId: '12345'
      });
      expect(error).toBeInstanceOf(SessionError);
      expect(error.code).toBe('SESSION_ERROR');
      expect(error.details?.sessionId).toBe('12345');
    });
  });

  describe('错误包装函数', () => {
    it('应该包装原生Error为DeepseekError', () => {
      const originalError = new Error('原始错误');
      const wrapped = wrapError(originalError);

      expect(wrapped).toBeInstanceOf(DeepseekError);
      expect(wrapped.cause).toBe(originalError);
    });

    it('应该识别网络错误', () => {
      const networkError = new Error('network connection failed');
      const wrapped = wrapError(networkError);

      expect(wrapped).toBeInstanceOf(NetworkError);
    });

    it('应该识别文件系统错误', () => {
      const fsError = new Error('ENOENT: file not found');
      const wrapped = wrapError(fsError);

      expect(wrapped).toBeInstanceOf(FileSystemError);
    });

    it('应该包装字符串错误', () => {
      const wrapped = wrapError('字符串错误');
      expect(wrapped).toBeInstanceOf(DeepseekError);
      expect(wrapped.message).toBe('字符串错误');
    });

    it('应该包装未知类型错误', () => {
      const wrapped = wrapError(123);
      expect(wrapped).toBeInstanceOf(DeepseekError);
      expect(wrapped.message).toBe('Unknown error occurred');
    });
  });

  describe('可操作错误判断', () => {
    it('应该识别可操作错误', () => {
      const operationalError = new DeepseekError('错误', 'TEST_ERROR', {
        isOperational: true
      });
      expect(isOperationalError(operationalError)).toBe(true);
    });

    it('应该识别非可操作错误', () => {
      const nonOperationalError = new DeepseekError('错误', 'TEST_ERROR', {
        isOperational: false
      });
      expect(isOperationalError(nonOperationalError)).toBe(false);
    });

    it('应该处理非DeepseekError', () => {
      const nativeError = new Error('原生错误');
      expect(isOperationalError(nativeError)).toBe(false);
    });
  });

  describe('安全执行函数', () => {
    it('应该成功执行函数', async () => {
      const result = await safeExecute(async () => '成功');
      expect(result).toBe('成功');
    });

    it('应该捕获错误并返回undefined', async () => {
      const errorHandler = vi.fn();
      const result = await safeExecute(async () => {
        throw new Error('执行失败');
      }, errorHandler);

      expect(result).toBeUndefined();
      expect(errorHandler).toHaveBeenCalled();
      expect(errorHandler.mock.calls[0][0]).toBeInstanceOf(DeepseekError);
    });
  });

  describe('重试逻辑', () => {
    it('应该成功执行无需重试', async () => {
      const operation = vi.fn().mockResolvedValue('成功');
      const retryOperation = withRetry(operation, { maxRetries: 3 });

      const result = await retryOperation();
      expect(result).toBe('成功');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('应该在失败后重试', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('第一次失败'))
        .mockResolvedValueOnce('重试成功');

      const retryOperation = withRetry(operation, {
        maxRetries: 3,
        retryDelay: 10,
        shouldRetry: () => true // 总是重试
      });

      const result = await retryOperation();
      expect(result).toBe('重试成功');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('应该在达到最大重试次数后失败', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('总是失败'));
      const retryOperation = withRetry(operation, {
        maxRetries: 2,
        retryDelay: 10,
        shouldRetry: () => true // 总是重试
      });

      await expect(retryOperation()).rejects.toThrow();
      expect(operation).toHaveBeenCalledTimes(3); // 初始 + 2次重试
    });

    it('应该调用重试回调', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('失败'))
        .mockResolvedValueOnce('成功');

      const onRetry = vi.fn();
      const retryOperation = withRetry(operation, {
        maxRetries: 3,
        retryDelay: 10,
        shouldRetry: () => true, // 总是重试
        onRetry
      });

      await retryOperation();
      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error));
    });
  });

  describe('恢复建议', () => {
    it('应该为认证错误提供建议', () => {
      const error = new AuthenticationError('认证失败');
      const suggestions = createRecoverySuggestions(error);

      expect(suggestions).toContain('运行 `deepseek code login` 重新登录');
      expect(suggestions).toContain('检查您的API密钥是否有效');
    });

    it('应该为网络错误提供建议', () => {
      const error = new NetworkError('网络连接失败');
      const suggestions = createRecoverySuggestions(error);

      expect(suggestions).toContain('检查网络连接');
      expect(suggestions).toContain('确认API端点可访问');
    });

    it('应该为配置错误提供建议', () => {
      const error = new ConfigurationError('配置错误');
      const suggestions = createRecoverySuggestions(error);

      expect(suggestions).toContain('检查配置文件格式');
      expect(suggestions).toContain('运行 `deepseek code doctor` 诊断配置问题');
    });

    it('应该为未知错误提供通用建议', () => {
      const error = new DeepseekError('未知错误', 'UNKNOWN_ERROR');
      const suggestions = createRecoverySuggestions(error);

      expect(suggestions).toContain('查看日志获取详细信息');
      expect(suggestions).toContain('运行 `deepseek code doctor` 诊断问题');
    });
  });

  describe('错误显示格式化', () => {
    it('应该格式化错误显示', () => {
      const error = new ApiError('API调用失败', {
        statusCode: 500,
        apiEndpoint: 'https://api.example.com'
      });

      const formatted = formatErrorForDisplay(error);

      expect(formatted).toContain('❌ [API_500] API调用失败');
      expect(formatted).toContain('详细信息:');
      expect(formatted).toContain('statusCode: 500');
      expect(formatted).toContain('建议的解决方法:');
    });

    it('应该处理没有详细信息的错误', () => {
      const error = new DeepseekError('简单错误', 'SIMPLE_ERROR');
      const formatted = formatErrorForDisplay(error);

      expect(formatted).toContain('❌ [SIMPLE_ERROR] 简单错误');
      expect(formatted).not.toContain('详细信息:');
      expect(formatted).toContain('建议的解决方法:');
    });
  });
});