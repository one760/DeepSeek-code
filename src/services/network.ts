export type NetworkCheckResult = {
  reachable: boolean;
  status?: number;
  error?: string;
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
    return {
      reachable: false,
      error: error instanceof Error ? error.message : String(error)
    };
  } finally {
    clearTimeout(timeout);
  }
}
