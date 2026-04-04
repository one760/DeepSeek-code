import { describe, expect, it, vi } from "vitest";
import {
  calculateDelay,
  isRetryableError,
  withRetry
} from "../src/provider/deepseek/retry.js";

describe("retry helpers", () => {
  it("detects retryable network and rate-limit errors", () => {
    expect(isRetryableError({ status: 429 })).toBe(true);
    expect(isRetryableError({ status: 503 })).toBe(true);
    expect(isRetryableError({ code: "ECONNRESET" })).toBe(true);
    expect(isRetryableError({ status: 400 })).toBe(false);
  });

  it("backs off with a bounded delay", () => {
    const delay = calculateDelay(2, {
      maxRetries: 3,
      initialDelayMs: 1000,
      maxDelayMs: 30_000,
      backoffMultiplier: 2
    });

    expect(delay).toBeGreaterThan(0);
    expect(delay).toBeLessThanOrEqual(30000);
  });

  it("retries until success and emits retry metadata", async () => {
    const onRetry = vi.fn();
    let attempts = 0;

    const result = await withRetry(
      async () => {
        attempts += 1;
        if (attempts < 2) {
          throw { status: 503 };
        }
        return "ok";
      },
      {
        maxRetries: 2,
        initialDelayMs: 1,
        maxDelayMs: 5,
        backoffMultiplier: 2
      },
      onRetry
    );

    expect(result).toBe("ok");
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
