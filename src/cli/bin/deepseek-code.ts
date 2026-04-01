import { runCli } from "../program.js";

void runCli([
  process.argv[0] ?? "node",
  "deepseek",
  "code",
  ...process.argv.slice(2)
]);
