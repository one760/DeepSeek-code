import fs from "node:fs/promises";
import path from "node:path";

export const PROJECT_INSTRUCTIONS_FILENAME = ".deepseek-code.md";

export async function loadProjectInstructions(
  workspaceRoot: string
): Promise<string | null> {
  const filePath = path.join(workspaceRoot, PROJECT_INSTRUCTIONS_FILENAME);

  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}
