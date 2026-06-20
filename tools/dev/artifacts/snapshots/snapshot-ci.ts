import { spawn } from "node:child_process";
import { createWriteStream, existsSync } from "node:fs";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

const SNAPSHOT_DIR = path.join("test-results", "snapshots");
const SERVER_LOG_PATH = path.join("test-results", "e2e-snapshot-server.log");
const PREVIEW_BRANCH = "e2e-snapshot-artifacts";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function isHealthy() {
  const response = await fetch("http://127.0.0.1:3000/").catch(() => null);
  return response?.ok === true;
}

async function printServerLog() {
  if (!existsSync(SERVER_LOG_PATH)) return;
  const log = await fs.readFile(SERVER_LOG_PATH, "utf8");
  if (log) process.stderr.write(log);
}

async function runCommand(command: string, args: string[]) {
  const child = spawn(command, args, { stdio: "inherit" });
  const exitCode = await new Promise<number | null>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", resolve);
  });

  if (exitCode !== 0) {
    throw new Error(
      `${[command, ...args].join(" ")} exited with code ${exitCode ?? 1}`,
    );
  }
}

async function captureSnapshots() {
  await fs.mkdir(SNAPSHOT_DIR, { recursive: true });
  await fs.mkdir(path.dirname(SERVER_LOG_PATH), { recursive: true });

  const logStream = createWriteStream(SERVER_LOG_PATH, { flags: "w" });
  // Bun 1.3 on CI cannot accept a WriteStream directly in child stdio.
  const server = spawn("bun", ["run", "tools/dev/e2e.ts", "start"], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout?.pipe(logStream, { end: false });
  server.stderr?.pipe(logStream, { end: false });

  let serverExitCode: number | null = null;
  const serverClosed = new Promise<void>((resolve) => {
    server.once("close", () => resolve());
  });
  server.once("exit", (code) => {
    serverExitCode = code;
  });

  const stopServer = () => {
    if (!server.killed) server.kill("SIGTERM");
  };
  process.once("SIGINT", stopServer);
  process.once("SIGTERM", stopServer);

  try {
    for (let attempt = 0; attempt < 90; attempt++) {
      if (await isHealthy()) break;
      if (serverExitCode !== null) {
        await printServerLog();
        throw new Error(
          `E2E snapshot server exited with code ${serverExitCode}`,
        );
      }
      await sleep(2000);
    }

    if (!(await isHealthy())) {
      await printServerLog();
      throw new Error("E2E snapshot server did not become healthy");
    }

    for (const mode of ["pages", "api", "mcp", "manifest"]) {
      await runCommand("bun", [
        "run",
        "tools/dev/artifacts/snapshots/snapshot-capture.ts",
        mode,
      ]);
    }
  } finally {
    process.off("SIGINT", stopServer);
    process.off("SIGTERM", stopServer);
    stopServer();
    await Promise.race([serverClosed, sleep(5_000)]);
    server.stdout?.unpipe(logStream);
    server.stderr?.unpipe(logStream);
    logStream.end();
  }
}

async function runGit(
  args: string[],
  options: { cwd?: string; quiet?: boolean } = {},
) {
  return new Promise<number>((resolve, reject) => {
    const child = spawn("git", args, {
      cwd: options.cwd,
      stdio: options.quiet ? "ignore" : "inherit",
    });
    child.once("error", reject);
    child.once("close", (code) => resolve(code ?? 1));
  });
}

async function requireGit(args: string[], cwd?: string) {
  const exitCode = await runGit(args, { cwd });
  if (exitCode !== 0) {
    throw new Error(`git ${args.join(" ")} exited with code ${exitCode}`);
  }
}

async function collectScreenshots(dir: string): Promise<string[]> {
  const entries = await fs
    .readdir(dir, { withFileTypes: true })
    .catch(() => []);
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) return collectScreenshots(entryPath);
      if (entry.isFile() && entry.name === "screenshot.png") return [entryPath];
      return [];
    }),
  );
  return files.flat();
}

function readOption(name: string) {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

async function publishPreviews() {
  const commit = readOption("--commit") ?? process.env.GITHUB_SHA;
  const repository =
    readOption("--repository") ?? process.env.GITHUB_REPOSITORY;

  if (!commit) throw new Error("--commit or GITHUB_SHA is required");
  if (!repository)
    throw new Error("--repository or GITHUB_REPOSITORY is required");

  const previewRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "life-ustc-e2e-snapshots-"),
  );

  await runGit(["fetch", "origin", PREVIEW_BRANCH], { quiet: true });
  const hasPreviewBranch =
    (await runGit(["rev-parse", "--verify", `origin/${PREVIEW_BRANCH}`], {
      quiet: true,
    })) === 0;

  if (hasPreviewBranch) {
    await requireGit([
      "worktree",
      "add",
      previewRoot,
      `origin/${PREVIEW_BRANCH}`,
    ]);
  } else {
    await requireGit(["worktree", "add", "--detach", previewRoot]);
    await requireGit(["switch", "--orphan", PREVIEW_BRANCH], previewRoot);
    await runGit(["rm", "-rf", "."], { cwd: previewRoot, quiet: true });
  }

  const commitRoot = path.join(previewRoot, commit);
  await fs.rm(commitRoot, { recursive: true, force: true });
  await fs.mkdir(commitRoot, { recursive: true });

  for (const screenshot of await collectScreenshots(
    path.join(SNAPSHOT_DIR, "pages"),
  )) {
    const relativePath = path.relative(SNAPSHOT_DIR, screenshot);
    const targetPath = path.join(commitRoot, relativePath);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.copyFile(screenshot, targetPath);
  }

  await requireGit(["config", "user.name", "github-actions[bot]"], previewRoot);
  await requireGit(
    [
      "config",
      "user.email",
      "41898282+github-actions[bot]@users.noreply.github.com",
    ],
    previewRoot,
  );
  await requireGit(["add", commit], previewRoot);

  const hasChanges =
    (await runGit(["diff", "--cached", "--quiet"], {
      cwd: previewRoot,
      quiet: true,
    })) !== 0;

  if (hasChanges) {
    await requireGit(
      [
        "commit",
        "-m",
        `chore: publish e2e screenshots for ${commit} [skip ci]`,
      ],
      previewRoot,
    );
    await requireGit(["push", "origin", `HEAD:${PREVIEW_BRANCH}`], previewRoot);
  }

  const baseUrl = `https://raw.githubusercontent.com/${repository}/${PREVIEW_BRANCH}/${commit}`;
  const githubOutput = process.env.GITHUB_OUTPUT;
  if (githubOutput) {
    await fs.appendFile(githubOutput, `base-url=${baseUrl}\n`);
  }
  console.log(baseUrl);
}

const command = process.argv[2];

async function main() {
  if (command === "capture") {
    await captureSnapshots();
    return;
  }

  if (command === "publish-previews") {
    await publishPreviews();
    return;
  }

  console.error(
    "Usage: bun run tools/dev/artifacts/snapshots/snapshot-ci.ts <capture|publish-previews>",
  );
  process.exit(2);
}

try {
  await main();
} catch (error) {
  const message =
    error instanceof Error ? (error.stack ?? error.message) : String(error);
  console.error(message);
  process.exit(1);
}
