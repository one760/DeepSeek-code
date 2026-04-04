export type RetryConfig = {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
};

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1_000,
  maxDelayMs: 30_000,
  backoffMultiplier: 2
};

function sleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

export function isRetryableError(error: unknown): boolean {
  const candidate = error as {
    status?: number;
    code?: string;
    cause?: { code?: string };
  };
  const status = candidate?.status;
  const code = candidate?.code ?? candidate?.cause?.code;

  if (typeof status === "number" && (status === 429 || status >= 500)) {
    return true;
  }

  return [
    "ECONNRESET",
    "ECONNREFUSED",
    "ETIMEDOUT",
    "ENOTFOUND",
    "EAI_AGAIN",
    "UND_ERR_CONNECT_TIMEOUT",
    "UND_ERR_HEADERS_TIMEOUT",
    "UND_ERR_SOCKET"
  ].includes(code ?? "");
}

export function calculateDelay(
  attempt: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): number {
  const exponential = Math.min(
    config.maxDelayMs,
    config.initialDelayMs * config.backoffMultiplier ** Math.max(0, attempt - 1)
  );
  const jitter = 0.8 + Math.random() * 0.4;
  return Math.round(exponential * jitter);
}

export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  config: Partial<RetryConfig> = {},
  onRetry?: (event: { attempt: number; error: unknown; delayMs: number }) => void
): Promise<T> {
  const resolved = { ...DEFAULT_RETRY_CONFIG, ...config };
  let attempt = 0;

  while (true) {
    try {
      return await fn(attempt);
    } catch (error) {
      if (attempt >= resolved.maxRetries || !isRetryableError(error)) {
        throw error;
      }

      attempt += 1;
      const delayMs = calculateDelay(attempt, resolved);
      onRetry?.({ attempt, error, delayMs });
      await sleep(delayMs);
    }
  }
}
