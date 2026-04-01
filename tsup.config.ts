import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: {
      index: "src/index.ts",
      "cli/bin/deepseek": "src/cli/bin/deepseek.ts",
      "cli/bin/deepseek-code": "src/cli/bin/deepseek-code.ts"
    },
    format: ["esm"],
    platform: "node",
    target: "node20",
    dts: true,
    sourcemap: true,
    clean: true,
    banner: {
      js: "#!/usr/bin/env node"
    }
  }
]);
