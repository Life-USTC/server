import { spawn } from "node:child_process";

const separatorIndex = process.argv.indexOf("--");
const commandIndex = separatorIndex === -1 ? 2 : separatorIndex + 1;
const command = process.argv[commandIndex];
const args = process.argv.slice(commandIndex + 1);

if (!command) {
  console.error("Usage: bun run tools/dev/quiet.ts -- <command> [args...]");
  process.exit(1);
}

const proc = spawn(command, args, {
  env: process.env,
  stdio: ["ignore", "pipe", "pipe"],
});

let stdout = "";
let stderr = "";

proc.stdout.setEncoding("utf8");
proc.stderr.setEncoding("utf8");
proc.stdout.on("data", (chunk) => {
  stdout += chunk;
});
proc.stderr.on("data", (chunk) => {
  stderr += chunk;
});

const exitCode = await new Promise<number | null>((resolve, reject) => {
  proc.on("error", reject);
  proc.on("close", resolve);
});

if (exitCode !== 0) {
  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);
  process.exit(exitCode);
}
