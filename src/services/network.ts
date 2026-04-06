export type NetworkCheckResult = {
  reachable: boolean;
  status?: number;
  error?: string;
  errorType?: string;
  suggestions?: string[];
};

export async function checkNetworkConnectivity(
  baseUrl: string,
  timeoutMs = 5000
): Promise<NetworkCheckResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(baseUrl, {
      method: "HEAD",
      signal: controller.signal
    });

    return {
      reachable: true,
      status: response.status
    };
  } catch (error) {
    const errorResult: NetworkCheckResult = {
      reachable: false,
      error: error instanceof Error ? error.message : String(error)
    };

    // 根据错误类型提供更多信息
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        errorResult.errorType = 'TIMEOUT';
        errorResult.suggestions = [
          '检查网络连接',
          '增加超时时间',
          '确认API端点可访问'
        ];
      } else if (error.message.includes('ENOTFOUND') || error.message.includes('EAI_AGAIN')) {
        errorResult.errorType = 'DNS_ERROR';
        errorResult.suggestions = [
          '检查DNS设置',
          '确认URL正确',
          '尝试使用IP地址'
        ];
      } else if (error.message.includes('ECONNREFUSED')) {
        errorResult.errorType = 'CONNECTION_REFUSED';
        errorResult.suggestions = [
          '确认服务正在运行',
          '检查防火墙设置',
          '确认端口正确'
        ];
      } else if (error.message.includes('network')) {
        errorResult.errorType = 'NETWORK_ERROR';
        errorResult.suggestions = [
          '检查网络连接',
          '重启路由器',
          '尝试使用其他网络'
        ];
      }
    }

    return errorResult;
  } finally {
    clearTimeout(timeout);
  }
}
