import { describe, expect, it } from "vitest";
import { createUnifiedDiff } from "../src/services/diffPreview.js";

describe("createUnifiedDiff", () => {
  it("renders a new-file preview", () => {
    const preview = createUnifiedDiff({
      pathLabel: "src/new-file.ts",
      beforeText: "",
      afterText: "console.log('hello');",
      isNewFile: true
    });

    expect(preview.preview).toContain("--- /dev/null");
    expect(preview.preview).toContain("+++ b/src/new-file.ts");
    expect(preview.preview).toContain("+console.log('hello');");
  });

  it("marks large diffs as truncated", () => {
    const preview = createUnifiedDiff({
      pathLabel: "README.md",
      beforeText: "old",
      afterText: Array.from({ length: 300 }, (_, index) => `line-${index}`).join("\n")
    });

    expect(preview.truncated).toBe(true);
    expect(preview.preview).toContain("...diff truncated...");
  });
});
