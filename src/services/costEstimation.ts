import type { SessionTokenUsage } from "../core/types.js";

export const MODEL_PRICING: Record<
  string,
  { inputPerMillion: number; outputPerMillion: number }
> = {
  "deepseek-chat": {
    inputPerMillion: 0.28,
    outputPerMillion: 0.42
  },
  "deepseek-reasoner": {
    inputPerMillion: 0.28,
    outputPerMillion: 0.42
  }
};

function getPricing(model: string) {
  return MODEL_PRICING[model] ?? MODEL_PRICING["deepseek-chat"];
}

export function estimateCost(
  model: string,
  inputTokens = 0,
  outputTokens = 0
): number {
  const pricing = getPricing(model);
  return (
    (inputTokens / 1_000_000) * pricing.inputPerMillion +
    (outputTokens / 1_000_000) * pricing.outputPerMillion
  );
}

export function formatCost(costUsd: number): string {
  return `~$${costUsd.toFixed(costUsd < 0.01 ? 4 : 3)}`;
}

function formatTokenCount(value = 0): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }

  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}k`;
  }

  return String(value);
}

export function formatTokenUsage(
  usage: SessionTokenUsage | undefined,
  model: string
): string {
  if (!usage) {
    return "tokens: n/a";
  }

  const cost = estimateCost(model, usage.totalInputTokens, usage.totalOutputTokens);
  return [
    `tokens: ${formatTokenCount(usage.totalInputTokens)} in / ${formatTokenCount(usage.totalOutputTokens)} out`,
    formatCost(cost)
  ].join(" | ");
}
