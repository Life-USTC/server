import { spawn } from "node:child_process";

type RunCommandOptions = {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  quiet?: boolean;
};

export async function runCommand(
  command: string,
  args: string[] = [],
  options: RunCommandOptions = {},
) {
  const proc = spawn(command, args, {
    cwd: options.cwd,
    env: options.env ?? process.env,
    stdio: options.quiet ? ["ignore", "pipe", "pipe"] : "inherit",
  });

  let stdout = "";
  let stderr = "";

  if (options.quiet && proc.stdout && proc.stderr) {
    proc.stdout.setEncoding("utf8");
    proc.stderr.setEncoding("utf8");
    proc.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    proc.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
  }

  const exitCode = await new Promise<number | null>((resolve, reject) => {
    proc.on("error", reject);
    proc.on("close", resolve);
  });

  if (exitCode === 0) return;

  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);

  const displayCommand = [command, ...args].join(" ");
  throw new Error(`${displayCommand} exited with code ${exitCode ?? 1}`);
}

export async function runMain(main: () => Promise<void>) {
  try {
    await main();
  } catch (error) {
    const message =
      error instanceof Error ? (error.stack ?? error.message) : String(error);
    console.error(message);
    process.exit(1);
  }
}
