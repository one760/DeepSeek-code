import { describe, expect, it } from "vitest";
import {
  estimateConversationTokens,
  estimateMessageTokens,
  estimateTokens,
  getModelContextLimit
} from "../src/core/tokenEstimation.js";

describe("token estimation", () => {
  it("estimates ASCII and CJK text heuristically", () => {
    expect(estimateTokens("abcdefgh")).toBeGreaterThanOrEqual(2);
    expect(estimateTokens("你好世界")).toBeGreaterThanOrEqual(2);
  });

  it("adds message overhead and tool-call payloads", () => {
    const estimate = estimateMessageTokens({
      id: "1",
      role: "assistant",
      content: "hello",
      createdAt: "2026-01-01T00:00:00.000Z",
      toolCalls: [{ id: "tool-1", name: "read_file", input: { path: "src/index.ts" } }]
    });

    expect(estimate).toBeGreaterThan(estimateTokens("hello"));
    expect(
      estimateConversationTokens([
        {
          id: "1",
          role: "user",
          content: "hello",
          createdAt: "2026-01-01T00:00:00.000Z"
        }
      ])
    ).toBeGreaterThan(0);
  });

  it("returns built-in and fallback context windows", () => {
    expect(getModelContextLimit("deepseek-chat")).toBe(128000);
    expect(getModelContextLimit("deepseek-reasoner")).toBe(128000);
    expect(getModelContextLimit("custom-model")).toBe(64000);
  });
});
