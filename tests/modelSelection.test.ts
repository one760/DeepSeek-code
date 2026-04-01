import { describe, expect, it } from "vitest";
import { formatModelHelp, resolveModelSelection } from "../src/app/modelSelection.js";

describe("model selection", () => {
  it("maps built-in aliases to canonical DeepSeek model names", () => {
    expect(resolveModelSelection("chat")).toBe("deepseek-chat");
    expect(resolveModelSelection("reasoner")).toBe("deepseek-reasoner");
    expect(resolveModelSelection("reasoning")).toBe("deepseek-reasoner");
  });

  it("keeps custom model names untouched", () => {
    expect(resolveModelSelection("deepseek-v3.2")).toBe("deepseek-v3.2");
  });

  it("formats model help as a switch guide", () => {
    const help = formatModelHelp("deepseek-chat");

    expect(help).toContain("Current model: deepseek-chat");
    expect(help).toContain("Switch with `/model <name>`.");
    expect(help).toContain("Aliases: chat, reasoner");
  });
});
