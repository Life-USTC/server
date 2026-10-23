import { execFile } from "node:child_process";
import { appendFile } from "node:fs/promises";
import { promisify } from "node:util";
import {
  type BuildCheck,
  DEFAULT_WATCH_OPTIONS,
  formatOrderingReport,
  isCommitSha,
  type OrderingWatchOptions,
  PRODUCTION_BUILD_CHECK_APP,
  PRODUCTION_VERSION_MARKER_PATH,
  shortCommit,
  watchDeploymentOrdering,
} from "./deployment-ordering";

const run = promisify(execFile);

const DEFAULT_HISTORY_DEPTH = 12;

function requiredSetting(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Required setting ${name} is unavailable.`);
  return value;
}

function numericSetting(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return value;
}

async function git(arguments_: string[]): Promise<string> {
  const { stdout } = await run("git", arguments_);
  return stdout;
}

async function readHistory(depth: number): Promise<string[]> {
  await git(["fetch", "--quiet", "origin", "main"]);
  const stdout = await git([
    "rev-list",
    "--first-parent",
    `--max-count=${depth}`,
    "FETCH_HEAD",
  ]);
  return stdout.split("\n").filter(isCommitSha);
}

/**
 * Build checks for the supplied commits. `filter=all` keeps every check run,
 * so a retried build is observed as its own build instead of replacing the
 * build that already published; progress attempts of one build are collapsed
 * by their shared build identifier.
 */
async function readBuilds(
  repository: string,
  token: string,
  commits: string[],
): Promise<BuildCheck[]> {
  const builds: BuildCheck[] = [];
  for (const commit of commits) {
    const path = `/repos/${repository}/commits/${commit}/check-runs?per_page=100&filter=all`;
    const response = await fetch(`https://api.github.com${path}`, {
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${token}`,
        "x-github-api-version": "2022-11-28",
      },
    });
    if (!response.ok) {
      // The response body can repeat request details; the status and the
      // commit are the whole diagnosis and carry no credential.
      throw new Error(
        `Reading build checks for ${shortCommit(commit)} failed with HTTP ${response.status}.`,
      );
    }
    const payload = (await response.json()) as {
      check_runs?: {
        id?: number;
        external_id?: string | null;
        app?: { slug?: string };
        status?: string;
        conclusion?: string | null;
        completed_at?: string | null;
      }[];
    };
    for (const checkRun of payload.check_runs ?? []) {
      if (checkRun.app?.slug !== PRODUCTION_BUILD_CHECK_APP) continue;
      builds.push({
        commit,
        buildId: checkRun.external_id?.trim() || `check-${checkRun.id}`,
        status: checkRun.status ?? "queued",
        conclusion: checkRun.conclusion ?? null,
        completedAt: checkRun.completed_at ?? null,
      });
    }
  }
  return builds;
}

/**
 * Commit marker of the version production serves. The marker is the public
 * build identity of the live version, not production data, and the read is
 * unauthenticated so no deployment credential takes part in verification.
 */
async function readLiveVersion(origin: string): Promise<string | null> {
  const response = await fetch(
    new URL(PRODUCTION_VERSION_MARKER_PATH, origin),
    { cache: "no-store", headers: { "cache-control": "no-cache" } },
  );
  if (!response.ok) return null;
  const payload = (await response.json()) as { version?: unknown };
  return typeof payload.version === "string" ? payload.version : null;
}

async function report(title: string, message: string, level: string) {
  console.log(`::${level} title=${title}::${message}`);
  const summaryFile = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryFile) return;
  await appendFile(summaryFile, `## ${title}\n\n${message}\n`);
}

async function main() {
  const repository = requiredSetting("GITHUB_REPOSITORY");
  const token = requiredSetting("GITHUB_TOKEN");
  const origin = requiredSetting("APP_PUBLIC_ORIGIN");
  const depth = numericSetting(
    "DEPLOYMENT_ORDERING_HISTORY_DEPTH",
    DEFAULT_HISTORY_DEPTH,
  );
  const options: OrderingWatchOptions = {
    pollSeconds: numericSetting(
      "DEPLOYMENT_ORDERING_POLL_SECONDS",
      DEFAULT_WATCH_OPTIONS.pollSeconds,
    ),
    settleSeconds: numericSetting(
      "DEPLOYMENT_ORDERING_SETTLE_SECONDS",
      DEFAULT_WATCH_OPTIONS.settleSeconds,
    ),
    deadlineSeconds: numericSetting(
      "DEPLOYMENT_ORDERING_DEADLINE_SECONDS",
      DEFAULT_WATCH_OPTIONS.deadlineSeconds,
    ),
  };

  const triggeringCommit = process.env.GITHUB_SHA?.trim();
  const history = await readHistory(depth);
  if (
    isCommitSha(triggeringCommit) &&
    history[0] !== undefined &&
    history[0] !== triggeringCommit
  ) {
    await report(
      "Production deployment ordering not verified here",
      `Main advanced to ${shortCommit(history[0])} after ${shortCommit(triggeringCommit)}; the run for the newer commit verifies the delivered version.`,
      "notice",
    );
    return;
  }

  const verdict = await watchDeploymentOrdering(
    {
      readHistory: () => readHistory(depth),
      readBuilds: (commits) => readBuilds(repository, token, commits),
      readLiveVersion: () => readLiveVersion(origin),
      sleep: (seconds) =>
        new Promise((resolve) => setTimeout(resolve, seconds * 1_000)),
      now: () => Date.now(),
    },
    options,
  );

  const outcome = formatOrderingReport(verdict);
  await report(outcome.title, outcome.message, outcome.level);
  if (outcome.failed) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
