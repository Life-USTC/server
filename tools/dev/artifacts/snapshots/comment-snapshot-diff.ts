import { spawn } from "node:child_process";
import * as fs from "node:fs/promises";

type Options = {
  bodyFile: string;
  pr?: string;
  commit?: string;
};

function usage() {
  return [
    "Usage:",
    "  bun run tools/dev/artifacts/snapshots/comment-snapshot-diff.ts --body-file <report.md> (--pr <number> | --commit <sha>)",
  ].join("\n");
}

function parseArgs(argv: string[]): Options {
  let bodyFile = "";
  let pr: string | undefined;
  let commit: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--body-file") {
      bodyFile = argv[index + 1] ?? "";
      index += 1;
    } else if (arg === "--pr") {
      pr = argv[index + 1];
      index += 1;
    } else if (arg === "--commit") {
      commit = argv[index + 1];
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      console.log(usage());
      process.exit(0);
    } else {
      throw new Error(usage());
    }
  }

  if (!bodyFile || (pr ? 1 : 0) + (commit ? 1 : 0) !== 1) {
    throw new Error(usage());
  }

  return { bodyFile, pr, commit };
}

function runGh(args: string[], input?: string) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn("gh", args, {
      cwd: process.cwd(),
      stdio: ["pipe", "inherit", "inherit"],
    });
    if (input) {
      child.stdin.end(input);
    } else {
      child.stdin.end();
    }
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`gh exited with code ${code}`));
    });
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const body = await fs.readFile(options.bodyFile, "utf8");

  if (options.pr) {
    await runGh(["pr", "comment", options.pr, "--body-file", options.bodyFile]);
    return;
  }

  if (options.commit) {
    await runGh(
      [
        "api",
        "--method",
        "POST",
        `repos/:owner/:repo/commits/${options.commit}/comments`,
        "--input",
        "-",
      ],
      JSON.stringify({ body }),
    );
  }
}

await main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
