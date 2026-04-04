import { describe, expect, it } from "vitest";
import {
  estimateCost,
  formatCost,
  formatTokenUsage
} from "../src/services/costEstimation.js";

describe("cost estimation", () => {
  it("estimates conservative cost for built-in models", () => {
    expect(estimateCost("deepseek-chat", 1000, 1000)).toBeGreaterThan(0);
    expect(estimateCost("deepseek-reasoner", 1000, 1000)).toBeGreaterThan(0);
  });

  it("formats cost and usage summaries", () => {
    expect(formatCost(0.0084)).toContain("$");
    expect(
      formatTokenUsage(
        {
          totalInputTokens: 12_300,
          totalOutputTokens: 2_100,
          totalTokens: 14_400,
          turnCount: 3
        },
        "deepseek-chat"
      )
    ).toContain("12.3k");
  });
});
