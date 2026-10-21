/**
 * Production deployment ordering evidence.
 *
 * Cloudflare's Git integration owns production deployment, and overlapping
 * builds can publish out of order: a build started for an older main commit can
 * finish after a newer commit already reached production and replace it. Both
 * build checks report success in that case, so a successful build check is not
 * evidence that production serves the commit it was created for.
 *
 * These helpers compare the commit marker production actually serves with the
 * newest main commit whose build succeeded. Inputs are main's own commit order,
 * public build check results and the public version marker, so verification
 * needs no deployment credential and reads no production data.
 *
 * Commit order comes from main's history, never from build timestamps: two
 * builds can report the same completion second, and a retried build completes
 * long after the commit it rebuilds. Timestamps are reported as evidence only.
 */

/** GitHub App that publishes the production build check runs. */
export const PRODUCTION_BUILD_CHECK_APP = "cloudflare-workers-and-pages";

/** Public path whose payload carries the built commit of the live version. */
export const PRODUCTION_VERSION_MARKER_PATH = "/_app/version.json";

const COMMIT_SHA_PATTERN = /^[0-9a-f]{40}$/;

export type BuildCheck = {
  /** Main commit the build was created for. */
  commit: string;
  /**
   * Cloudflare build the check run reports on. One build reports progress
   * through several check runs that share this identifier; a retried build is
   * a different build and gets its own identifier.
   */
  buildId: string;
  /** GitHub check run status: `queued`, `in_progress` or `completed`. */
  status: string;
  /** GitHub check run conclusion once completed. */
  conclusion: string | null;
  /** ISO 8601 completion instant, reported as evidence only. */
  completedAt: string | null;
};

export type OrderingSnapshot = {
  /** Main commits, newest first. */
  history: string[];
  /** Build checks observed for those commits, retried attempts included. */
  builds: BuildCheck[];
  /** Version marker served by production, or null when it was unreadable. */
  liveVersion: string | null;
};

export type OrderingVerdict =
  | { status: "verified"; commit: string }
  | { status: "pending"; pendingCommits: string[] }
  | { status: "ahead"; liveCommit: string; expectedCommit: string }
  | {
      status: "superseded";
      liveCommit: string;
      expectedCommit: string;
      liveBuildCompletedAt: string | null;
      expectedBuildCompletedAt: string | null;
      commitsBehind: number;
    }
  | { status: "inconclusive"; reason: string };

export function isCommitSha(value: unknown): value is string {
  return typeof value === "string" && COMMIT_SHA_PATTERN.test(value);
}

export function shortCommit(commit: string): string {
  return commit.slice(0, 12);
}

function isCompleted(build: BuildCheck): boolean {
  return build.status === "completed";
}

function isSuccessful(build: BuildCheck): boolean {
  return isCompleted(build) && build.conclusion === "success";
}

/**
 * One state per Cloudflare build.
 *
 * A build reports progress through several check runs that share its build
 * identifier, and the earlier attempts keep their unfinished status forever.
 * Reading those attempts as separate builds would leave every commit looking
 * permanently unfinished, so a build counts as finished once any of its check
 * runs completed, and its outcome is the latest completion it reported.
 */
export function collapseBuildAttempts(
  builds: readonly BuildCheck[],
): BuildCheck[] {
  const collapsed = new Map<string, BuildCheck>();
  for (const build of builds) {
    const key = `${build.commit}\u0000${build.buildId}`;
    const previous = collapsed.get(key);
    if (previous === undefined) {
      collapsed.set(key, build);
      continue;
    }
    if (!isCompleted(build)) continue;
    if (
      !isCompleted(previous) ||
      (build.completedAt ?? "") > (previous.completedAt ?? "")
    ) {
      collapsed.set(key, build);
    }
  }
  return [...collapsed.values()];
}

function buildsInWindow(
  history: readonly string[],
  builds: readonly BuildCheck[],
): Map<string, BuildCheck[]> {
  const grouped = new Map<string, BuildCheck[]>(
    history.map((commit) => [commit, []]),
  );
  for (const build of collapseBuildAttempts(builds)) {
    grouped.get(build.commit)?.push(build);
  }
  return grouped;
}

/**
 * Main commits whose build can still publish, newest first. A commit stays
 * pending while any of its builds is unfinished, including a retry of a commit
 * that already built successfully: that retry can still replace production.
 */
export function pendingBuildCommits(
  history: readonly string[],
  builds: readonly BuildCheck[],
): string[] {
  const grouped = buildsInWindow(history, builds);
  return history.filter((commit) =>
    (grouped.get(commit) ?? []).some((build) => !isCompleted(build)),
  );
}

function latestSuccessfulCompletion(
  builds: readonly BuildCheck[],
): string | null {
  const completions = builds
    .filter(isSuccessful)
    .map((build) => build.completedAt)
    .filter((completedAt): completedAt is string => completedAt !== null)
    .toSorted();
  return completions.at(-1) ?? null;
}

/**
 * Newest main commit that is allowed to be in production: builds for later
 * commits either failed, were skipped as superseded, or never ran.
 */
export function selectExpectedCommit(
  history: readonly string[],
  builds: readonly BuildCheck[],
): string | null {
  const grouped = buildsInWindow(history, builds);
  return (
    history.find((commit) => (grouped.get(commit) ?? []).some(isSuccessful)) ??
    null
  );
}

export function evaluateDeploymentOrdering(
  snapshot: OrderingSnapshot,
): OrderingVerdict {
  const { history, builds, liveVersion } = snapshot;
  if (history.length === 0) {
    return { status: "inconclusive", reason: "no main history was observed" };
  }

  const pendingCommits = pendingBuildCommits(history, builds);
  if (pendingCommits.length > 0) {
    return { status: "pending", pendingCommits };
  }

  const expectedCommit = selectExpectedCommit(history, builds);
  if (expectedCommit === null) {
    return {
      status: "inconclusive",
      reason:
        "no observed main commit has a successful production build, so no commit is eligible for production",
    };
  }

  if (!isCommitSha(liveVersion)) {
    return {
      status: "inconclusive",
      reason:
        "production did not report a commit version marker, so the delivered commit could not be established",
    };
  }

  const expectedIndex = history.indexOf(expectedCommit);
  const liveIndex = history.indexOf(liveVersion);
  if (liveIndex < 0) {
    return {
      status: "inconclusive",
      reason: `the commit production reports (${shortCommit(liveVersion)}) is outside the observed main history`,
    };
  }
  if (liveIndex === expectedIndex) {
    return { status: "verified", commit: expectedCommit };
  }
  if (liveIndex < expectedIndex) {
    return { status: "ahead", liveCommit: liveVersion, expectedCommit };
  }

  const grouped = buildsInWindow(history, builds);
  return {
    status: "superseded",
    liveCommit: liveVersion,
    expectedCommit,
    liveBuildCompletedAt: latestSuccessfulCompletion(
      grouped.get(liveVersion) ?? [],
    ),
    expectedBuildCompletedAt: latestSuccessfulCompletion(
      grouped.get(expectedCommit) ?? [],
    ),
    commitsBehind: liveIndex - expectedIndex,
  };
}

export type OrderingReport = {
  level: "notice" | "warning" | "error";
  title: string;
  message: string;
  failed: boolean;
};

/**
 * One-line report for a workflow annotation and the run summary. Commit
 * identifiers and build completion instants are the only evidence included.
 */
export function formatOrderingReport(verdict: OrderingVerdict): OrderingReport {
  switch (verdict.status) {
    case "verified":
      return {
        level: "notice",
        title: "Production deployment ordering verified",
        message: `Production serves ${shortCommit(verdict.commit)}, the newest main commit with a successful production build.`,
        failed: false,
      };
    case "pending":
      return {
        level: "notice",
        title: "Production deployment ordering not settled",
        message: `Production builds are still able to publish for ${verdict.pendingCommits.map(shortCommit).join(", ")}.`,
        failed: false,
      };
    case "ahead":
      return {
        level: "warning",
        title: "Production deployment ordering unexpected",
        message: `Production serves ${shortCommit(verdict.liveCommit)}, which is newer than ${shortCommit(verdict.expectedCommit)}, the newest main commit with a successful production build.`,
        failed: false,
      };
    case "superseded":
      return {
        level: "error",
        title: "Production deployment ordering violated",
        message: `Production serves superseded commit ${shortCommit(verdict.liveCommit)} (built ${verdict.liveBuildCompletedAt ?? "at an unreported time"}), ${verdict.commitsBehind} commit(s) behind ${shortCommit(verdict.expectedCommit)} (built ${verdict.expectedBuildCompletedAt ?? "at an unreported time"}), which is the newest main commit with a successful production build. A later build replaced a newer delivered commit; redeliver the newest main commit.`,
        failed: true,
      };
    case "inconclusive":
      return {
        level: "error",
        title: "Production deployment ordering unverified",
        message: `The delivered production commit could not be verified: ${verdict.reason}.`,
        failed: true,
      };
  }
}

export type OrderingWatchDeps = {
  /** Main commits, newest first. */
  readHistory: () => Promise<string[]>;
  /** Build checks for the supplied commits, retried attempts included. */
  readBuilds: (commits: string[]) => Promise<BuildCheck[]>;
  /** Version marker production serves, or null when it was unreadable. */
  readLiveVersion: () => Promise<string | null>;
  sleep: (seconds: number) => Promise<void>;
  now: () => number;
};

export type OrderingWatchOptions = {
  pollSeconds: number;
  settleSeconds: number;
  deadlineSeconds: number;
};

export const DEFAULT_WATCH_OPTIONS: OrderingWatchOptions = {
  pollSeconds: 30,
  settleSeconds: 30,
  deadlineSeconds: 1_200,
};

/**
 * Watch until no build can still publish, then compare the delivered commit
 * with the expected one.
 *
 * A build that is still running is the ordering hazard itself, so the watch
 * keeps waiting while any observed commit has an unfinished build, re-reads the
 * builds after the settle interval, and only reports a regression when a second
 * observation agrees — a single read taken while the edge is switching versions
 * must not fail the run.
 */
export async function watchDeploymentOrdering(
  deps: OrderingWatchDeps,
  options: OrderingWatchOptions = DEFAULT_WATCH_OPTIONS,
): Promise<OrderingVerdict> {
  const deadline = deps.now() + options.deadlineSeconds * 1_000;

  const readSnapshot = async () => {
    const history = await deps.readHistory();
    return { history, builds: await deps.readBuilds(history) };
  };

  while (true) {
    const observed = await readSnapshot();
    const pending = pendingBuildCommits(observed.history, observed.builds);
    if (pending.length > 0) {
      if (deps.now() >= deadline) {
        return {
          status: "inconclusive",
          reason: `production builds for ${pending.map(shortCommit).join(", ")} were still able to publish when the verification deadline passed`,
        };
      }
      await deps.sleep(options.pollSeconds);
      continue;
    }

    await deps.sleep(options.settleSeconds);
    const settled = await readSnapshot();
    if (pendingBuildCommits(settled.history, settled.builds).length > 0) {
      continue;
    }

    const verdict = evaluateDeploymentOrdering({
      ...settled,
      liveVersion: await deps.readLiveVersion(),
    });
    if (verdict.status !== "superseded") return verdict;

    await deps.sleep(options.settleSeconds);
    const confirmation = await readSnapshot();
    if (
      pendingBuildCommits(confirmation.history, confirmation.builds).length > 0
    ) {
      continue;
    }
    return evaluateDeploymentOrdering({
      ...confirmation,
      liveVersion: await deps.readLiveVersion(),
    });
  }
}
