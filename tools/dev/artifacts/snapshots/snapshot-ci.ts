import { spawn } from "node:child_process";
import { createWriteStream, existsSync } from "node:fs";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { resolvePlaywrightServerRuntime } from "../../e2e";
import {
  type RenderOptions as SnapshotCommentRenderOptions,
  writeSnapshotComment,
} from "./snapshot-report";

const SNAPSHOT_DIR = path.join("test-results", "snapshots");
const SERVER_LOG_PATH = path.join("test-results", "e2e-snapshot-server.log");
const COMMENT_OUTPUT_PATH = path.join(
  "test-results",
  "e2e-snapshot-comment.md",
);
const PREVIEW_BRANCH = "e2e-snapshot-artifacts";
const PREVIEW_RETENTION_DAYS = 14;
const PREVIEW_COMMIT_DIR = /^[0-9a-f]{40}$/;
const FULL_COMMIT_SHA = /^[0-9a-fA-F]{40}$/;
const SAFE_GITHUB_NAME = /^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,98}[A-Za-z0-9])?$/;

type SnapshotCommentCommandOptions = {
  post: boolean;
  render: SnapshotCommentRenderOptions;
  repository?: string;
};

type PostCommitCommentOptions = {
  apiUrl?: string;
  body: string;
  commit: string;
  fetchImpl?: typeof fetch;
  repository: string;
  token?: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function validateCommitSha(value: string) {
  if (!FULL_COMMIT_SHA.test(value)) {
    throw new Error("commit must be a 40-character hexadecimal SHA");
  }
  return value.toLowerCase();
}

export function validateRepository(value: string) {
  const [owner, repo, extra] = value.split("/");
  if (
    !owner ||
    !repo ||
    extra !== undefined ||
    !SAFE_GITHUB_NAME.test(owner) ||
    !SAFE_GITHUB_NAME.test(repo)
  ) {
    throw new Error(
      "repository must be owner/repo using only safe GitHub name characters",
    );
  }
  return `${owner}/${repo}`;
}

export function snapshotPreviewBaseUrl(repository: string, commit: string) {
  const safeRepository = validateRepository(repository);
  const safeCommit = validateCommitSha(commit);
  return `https://raw.githubusercontent.com/${safeRepository}/${PREVIEW_BRANCH}/${safeCommit}`;
}

export function commitCommentApiUrl(
  repository: string,
  commit: string,
  apiUrl = "https://api.github.com",
) {
  const safeRepository = validateRepository(repository);
  const safeCommit = validateCommitSha(commit);
  const [owner, repo] = safeRepository.split("/");
  const base = apiUrl.endsWith("/") ? apiUrl : `${apiUrl}/`;
  return new URL(
    `repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits/${safeCommit}/comments`,
    base,
  ).toString();
}

async function isHealthy(baseUrl: string) {
  const response = await fetch(new URL("/", baseUrl)).catch(() => null);
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
  const { baseUrl } = resolvePlaywrightServerRuntime();
  await fs.mkdir(SNAPSHOT_DIR, { recursive: true });
  await fs.mkdir(path.dirname(SERVER_LOG_PATH), { recursive: true });

  const logStream = createWriteStream(SERVER_LOG_PATH, { flags: "w" });
  // Bun 1.3 on CI cannot accept a WriteStream directly in child stdio.
  const server = spawn("bun", ["run", "e2e:start"], {
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
      if (await isHealthy(baseUrl)) break;
      if (serverExitCode !== null) {
        await printServerLog();
        throw new Error(
          `E2E snapshot server exited with code ${serverExitCode}`,
        );
      }
      await sleep(2000);
    }

    if (!(await isHealthy(baseUrl))) {
      await printServerLog();
      throw new Error("E2E snapshot server did not become healthy");
    }

    await runCommand("bun", [
      "run",
      "tools/dev/artifacts/snapshots/snapshot-capture.ts",
      "all",
    ]);
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

async function gitOutput(args: string[], cwd: string) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn("git", args, {
      cwd,
      stdio: ["ignore", "pipe", "ignore"],
    });
    const chunks: Buffer[] = [];
    child.stdout.on("data", (chunk) => {
      chunks.push(Buffer.from(chunk));
    });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code !== 0) {
        resolve("");
        return;
      }
      resolve(Buffer.concat(chunks).toString("utf8").trim());
    });
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
      if (
        entry.isFile() &&
        (entry.name === "screenshot.png" ||
          entry.name === "mobile-screenshot.png")
      ) {
        return [entryPath];
      }
      return [];
    }),
  );
  return files.flat();
}

async function pruneStalePreviewDirectories(
  previewRoot: string,
  currentCommit: string,
) {
  const cutoffSeconds =
    Math.floor(Date.now() / 1000) - PREVIEW_RETENTION_DAYS * 24 * 60 * 60;
  const entries = await fs.readdir(previewRoot, { withFileTypes: true });

  for (const entry of entries) {
    if (
      !entry.isDirectory() ||
      entry.name === currentCommit ||
      !PREVIEW_COMMIT_DIR.test(entry.name)
    ) {
      continue;
    }

    const touchedAtText = await gitOutput(
      ["log", "-1", "--format=%ct", "--", entry.name],
      previewRoot,
    );
    const touchedAt = Number(touchedAtText);
    if (!Number.isFinite(touchedAt) || touchedAt >= cutoffSeconds) continue;

    await fs.rm(path.join(previewRoot, entry.name), {
      recursive: true,
      force: true,
    });
    console.log(`Pruned stale E2E snapshot previews for ${entry.name}`);
  }
}

function readOption(argv: string[], name: string) {
  const index = argv.indexOf(name);
  if (index === -1) return undefined;
  if (index + 1 >= argv.length) {
    throw new Error(`${name} requires a value`);
  }
  return argv[index + 1];
}

function hasFlag(argv: string[], name: string) {
  return argv.includes(name);
}

function readRequiredCommit(argv: string[], env: NodeJS.ProcessEnv) {
  const commit = readOption(argv, "--commit") ?? env.GITHUB_SHA;
  if (commit === undefined)
    throw new Error("--commit or GITHUB_SHA is required");
  return validateCommitSha(commit);
}

function readRequiredRepository(argv: string[], env: NodeJS.ProcessEnv) {
  const repository = readOption(argv, "--repository") ?? env.GITHUB_REPOSITORY;
  if (repository === undefined) {
    throw new Error("--repository or GITHUB_REPOSITORY is required");
  }
  return validateRepository(repository);
}

function readOptionalUrl(argv: string[], name: string) {
  const value = readOption(argv, name);
  return value ? value : undefined;
}

async function publishPreviews(
  argv: string[],
  env: NodeJS.ProcessEnv = process.env,
) {
  const commit = readRequiredCommit(argv, env);
  const repository = readRequiredRepository(argv, env);
  const previewRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "life-ustc-e2e-snapshots-"),
  );

  try {
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
    await pruneStalePreviewDirectories(previewRoot, commit);

    await requireGit(
      ["config", "user.name", "github-actions[bot]"],
      previewRoot,
    );
    await requireGit(
      [
        "config",
        "user.email",
        "41898282+github-actions[bot]@users.noreply.github.com",
      ],
      previewRoot,
    );
    await requireGit(["add", "--all", "."], previewRoot);

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
      await requireGit(
        ["push", "origin", `HEAD:${PREVIEW_BRANCH}`],
        previewRoot,
      );
    }

    const baseUrl = snapshotPreviewBaseUrl(repository, commit);
    const githubOutput = env.GITHUB_OUTPUT;
    if (githubOutput) {
      await fs.appendFile(githubOutput, `base-url=${baseUrl}\n`);
    }
    console.log(baseUrl);
  } finally {
    await runGit(["worktree", "remove", "--force", previewRoot], {
      quiet: true,
    });
    await fs.rm(previewRoot, { recursive: true, force: true });
  }
}

export function parseSnapshotCommentOptions(
  argv: string[],
  env: NodeJS.ProcessEnv = process.env,
): SnapshotCommentCommandOptions {
  const commit = readRequiredCommit(argv, env);
  const workflowUrl = readOptionalUrl(argv, "--workflow-url");
  const artifactUrl = readOptionalUrl(argv, "--artifact-url") ?? workflowUrl;
  const status = readOption(argv, "--status");
  if (!artifactUrl)
    throw new Error("--artifact-url or --workflow-url is required");
  if (!status) throw new Error("--status is required");

  const post = hasFlag(argv, "--post");
  const repository =
    post || readOption(argv, "--repository") !== undefined
      ? readRequiredRepository(argv, env)
      : undefined;

  return {
    post,
    repository,
    render: {
      snapshotDir: path.resolve(
        readOption(argv, "--snapshot-dir") ?? SNAPSHOT_DIR,
      ),
      artifactUrl,
      commit,
      output: path.resolve(readOption(argv, "--output") ?? COMMENT_OUTPUT_PATH),
      screenshotBaseUrl: readOptionalUrl(
        argv,
        "--screenshot-base-url",
      )?.replace(/\/$/, ""),
      status,
      workflowUrl,
    },
  };
}

export async function postCommitComment(options: PostCommitCommentOptions) {
  if (!options.body.trim()) {
    console.log("No E2E snapshot comment was generated.");
    return false;
  }

  if (!options.token) {
    throw new Error("GH_TOKEN or GITHUB_TOKEN is required to post a comment");
  }

  const response = await (options.fetchImpl ?? fetch)(
    commitCommentApiUrl(
      options.repository,
      options.commit,
      options.apiUrl ?? "https://api.github.com",
    ),
    {
      method: "POST",
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${options.token}`,
        "content-type": "application/json",
        "user-agent": "life-ustc-snapshot-ci",
        "x-github-api-version": "2022-11-28",
      },
      body: JSON.stringify({ body: options.body }),
    },
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    const suffix = detail ? `: ${detail.slice(0, 500)}` : "";
    throw new Error(
      `GitHub commit comment request failed with ${response.status} ${response.statusText}${suffix}`,
    );
  }

  return true;
}

async function renderAndMaybePostComment(
  argv: string[],
  env: NodeJS.ProcessEnv = process.env,
) {
  const options = parseSnapshotCommentOptions(argv, env);
  await writeSnapshotComment(options.render);

  if (!options.post) return;

  await postCommitComment({
    apiUrl: env.GITHUB_API_URL,
    body: await fs.readFile(options.render.output, "utf8"),
    commit: options.render.commit,
    repository: options.repository ?? readRequiredRepository(argv, env),
    token: env.GH_TOKEN ?? env.GITHUB_TOKEN,
  });
}

export async function main(argv = process.argv.slice(2)) {
  const [command, ...args] = argv;

  if (command === "capture") {
    await captureSnapshots();
    return;
  }

  if (command === "publish-previews") {
    await publishPreviews(args);
    return;
  }

  if (command === "comment") {
    await renderAndMaybePostComment(args);
    return;
  }

  console.error(
    [
      "Usage:",
      "  bun run snapshot:capture",
      "  bun run snapshot:publish-previews -- --commit <sha> --repository <owner/repo>",
      "  bun run snapshot:comment -- --commit <sha> --status <status> --workflow-url <url> [--artifact-url <url>] [--screenshot-base-url <url>] [--output <file>] [--post --repository <owner/repo>]",
    ].join("\n"),
  );
  process.exit(2);
}

if (process.argv[1]?.endsWith("snapshot-ci.ts")) {
  try {
    await main();
  } catch (error) {
    const message =
      error instanceof Error ? (error.stack ?? error.message) : String(error);
    console.error(message);
    process.exit(1);
  }
}
