import { describe, expect, it } from "vitest";
import { createInitialViewState, viewStateReducer } from "../src/app/viewStateReducer.js";

describe("viewStateReducer", () => {
  it("opens and closes resume overlay through reducer actions", () => {
    const opened = viewStateReducer(createInitialViewState(), {
      type: "open-resume",
      query: "build",
      matches: [],
      message: "No sessions matched this query."
    });

    expect(opened.viewMode).toBe("resume");
    expect(opened.overlay?.mode).toBe("resume");

    const closed = viewStateReducer(opened, { type: "close-overlay" });
    expect(closed).toEqual(createInitialViewState());
  });

  it("opens confirm overlay with the matching view mode", () => {
    const state = viewStateReducer(createInitialViewState(), {
      type: "open-confirm",
      confirmation: {
        request: {
          toolName: "write_file",
          input: { path: "a.txt" },
          message: "Allow write_file?",
          allowedDecisions: ["once", "session", "always", "deny"]
        },
        resolve: () => {}
      }
    });

    expect(state.viewMode).toBe("confirm");
    expect(state.overlay?.mode).toBe("confirm");
  });

  it("stores structured permission overlay data", () => {
    const state = viewStateReducer(createInitialViewState(), {
      type: "open-permissions",
      workspaceRoot: "/tmp/project",
      workspaceRules: ["write_file"],
      sessionRules: ["edit_file"]
    });

    expect(state.viewMode).toBe("permissions");
    expect(state.overlay).toEqual({
      mode: "permissions",
      workspaceRoot: "/tmp/project",
      workspaceRules: ["write_file"],
      sessionRules: ["edit_file"]
    });
  });
});
