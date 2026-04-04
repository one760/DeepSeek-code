import { describe, expect, it } from "vitest";
import { selectOverlayDescriptor } from "../src/app/overlaySelectors.js";

describe("overlay selectors", () => {
  it("formats permissions overlay from structured reducer state", () => {
    const descriptor = selectOverlayDescriptor({
      mode: "permissions",
      workspaceRoot: "/tmp/project",
      workspaceRules: ["write_file"],
      sessionRules: ["edit_file"]
    });

    expect(descriptor?.title).toBe("Permissions");
    expect(descriptor?.body).toContain("Workspace: /tmp/project");
    expect(descriptor?.body).toContain("- write_file");
    expect(descriptor?.body).toContain("- edit_file");
  });

  it("formats diff overlay hints", () => {
    const descriptor = selectOverlayDescriptor({
      mode: "diff",
      preview: {
        sessionId: "session-1",
        toolName: "write_file",
        targetLabel: "a.txt",
        preview: "@@",
        createdAt: "2026-04-02T00:00:00.000Z",
        truncated: true
      }
    });

    expect(descriptor?.title).toBe("Latest Diff · a.txt");
    expect(descriptor?.hint).toContain("Preview truncated");
  });
});
