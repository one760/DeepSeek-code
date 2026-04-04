import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  PROJECT_INSTRUCTIONS_FILENAME,
  loadProjectInstructions
} from "../src/services/projectInstructions.js";

describe("project instructions", () => {
  let workspaceRoot = "";

  beforeEach(async () => {
    workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "deepseek-code-project-instructions-"));
  });

  afterEach(async () => {
    if (workspaceRoot) {
      await fs.rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it("returns null when the file is missing", async () => {
    await expect(loadProjectInstructions(workspaceRoot)).resolves.toBeNull();
  });

  it("loads the root instruction file when present", async () => {
    await fs.writeFile(path.join(workspaceRoot, PROJECT_INSTRUCTIONS_FILENAME), "Stay concise.", "utf8");

    await expect(loadProjectInstructions(workspaceRoot)).resolves.toBe("Stay concise.");
  });
});
