import { describe, expect, it } from "vitest";
import {
  type BuildCheck,
  collapseBuildAttempts,
  DEFAULT_WATCH_OPTIONS,
  evaluateDeploymentOrdering,
  formatOrderingReport,
  type OrderingWatchDeps,
  pendingBuildCommits,
  watchDeploymentOrdering,
} from "../../../scripts/deploy/deployment-ordering";

// The 2026-10-21 ordering incident: #1294 merged first, #1283 merged 22
// seconds later, and the older commit's build published last.
const OLDER = "eeca62737bc82036e9a08ed7095ef66925e6c716";
const NEWER = "7191f4067868c2f57c0e89c6b9e2a4b08c3e86d6";
const NEWEST = "08fd8677f577e5ad8863beacec4d9d8aceaabb36";
const HISTORY = [NEWER, OLDER];

function completed(
  commit: string,
  conclusion: string,
  completedAt: string,
  buildId = `build-${completedAt}`,
): BuildCheck {
  return { commit, buildId, status: "completed", conclusion, completedAt };
}

function running(
  commit: string,
  status = "in_progress",
  buildId = `build-${commit}-${status}`,
): BuildCheck {
  return { commit, buildId, status, conclusion: null, completedAt: null };
}

describe("deployment ordering evaluation", () => {
  it("accepts the newest main commit when its build published last", () => {
    expect(
      evaluateDeploymentOrdering({
        history: HISTORY,
        builds: [
          completed(OLDER, "success", "2026-10-21T06:25:20Z"),
          completed(NEWER, "success", "2026-10-21T06:25:34Z"),
        ],
        liveVersion: NEWER,
      }),
    ).toEqual({ status: "verified", commit: NEWER });
  });

  it("rejects an older commit whose build finished after the newer commit was delivered", () => {
    const verdict = evaluateDeploymentOrdering({
      history: HISTORY,
      builds: [
        completed(NEWER, "success", "2026-10-21T06:25:34Z"),
        completed(OLDER, "success", "2026-10-21T06:25:44Z"),
      ],
      liveVersion: OLDER,
    });

    expect(verdict).toEqual({
      status: "superseded",
      liveCommit: OLDER,
      expectedCommit: NEWER,
      liveBuildCompletedAt: "2026-10-21T06:25:44Z",
      expectedBuildCompletedAt: "2026-10-21T06:25:34Z",
      commitsBehind: 1,
    });
    const report = formatOrderingReport(verdict);
    expect(report).toMatchObject({ level: "error", failed: true });
    expect(report.message).toContain(OLDER.slice(0, 12));
    expect(report.message).toContain(NEWER.slice(0, 12));
  });

  it("orders by main history rather than build completion instants", () => {
    const sameInstant = "2026-10-21T06:25:34Z";
    expect(
      evaluateDeploymentOrdering({
        history: HISTORY,
        builds: [
          completed(NEWER, "success", sameInstant),
          completed(OLDER, "success", sameInstant),
        ],
        liveVersion: OLDER,
      }),
    ).toMatchObject({ status: "superseded", commitsBehind: 1 });
  });

  it("counts a successful retry of a failed build as a delivered commit", () => {
    expect(
      evaluateDeploymentOrdering({
        history: HISTORY,
        builds: [
          completed(OLDER, "success", "2026-10-21T06:25:20Z"),
          completed(NEWER, "failure", "2026-10-21T06:25:34Z"),
          completed(NEWER, "success", "2026-10-21T06:40:11Z"),
        ],
        liveVersion: NEWER,
      }),
    ).toEqual({ status: "verified", commit: NEWER });
  });

  it("rejects a retried older build that republished over a newer commit", () => {
    expect(
      evaluateDeploymentOrdering({
        history: HISTORY,
        builds: [
          completed(NEWER, "success", "2026-10-21T06:25:34Z"),
          completed(OLDER, "success", "2026-10-21T06:25:20Z"),
          completed(OLDER, "success", "2026-10-21T07:10:02Z"),
        ],
        liveVersion: OLDER,
      }),
    ).toMatchObject({
      status: "superseded",
      liveBuildCompletedAt: "2026-10-21T07:10:02Z",
      commitsBehind: 1,
    });
  });

  it("keeps the previous commit eligible when the newest build did not publish", () => {
    for (const conclusion of ["failure", "cancelled", "skipped"]) {
      expect(
        evaluateDeploymentOrdering({
          history: HISTORY,
          builds: [
            completed(OLDER, "success", "2026-10-21T06:25:20Z"),
            completed(NEWER, conclusion, "2026-10-21T06:25:34Z"),
          ],
          liveVersion: OLDER,
        }),
      ).toEqual({ status: "verified", commit: OLDER });
    }
  });

  it("treats a commit without any build as not eligible for production", () => {
    expect(
      evaluateDeploymentOrdering({
        history: [NEWEST, ...HISTORY],
        builds: [
          completed(OLDER, "success", "2026-10-21T06:25:20Z"),
          completed(NEWER, "success", "2026-10-21T06:25:34Z"),
        ],
        liveVersion: NEWER,
      }),
    ).toEqual({ status: "verified", commit: NEWER });
  });

  it("ignores the unfinished progress attempts a finished build leaves behind", () => {
    // Cloudflare reports one build through several check runs that share its
    // build identifier, and the earlier attempt stays unfinished forever.
    const builds = [
      running(OLDER, "in_progress", "7af9a629"),
      completed(OLDER, "success", "2026-10-21T06:25:44Z", "7af9a629"),
      running(NEWER, "in_progress", "7cfbf1a5"),
      completed(NEWER, "success", "2026-10-21T06:25:34Z", "7cfbf1a5"),
    ];

    expect(collapseBuildAttempts(builds)).toEqual([
      completed(OLDER, "success", "2026-10-21T06:25:44Z", "7af9a629"),
      completed(NEWER, "success", "2026-10-21T06:25:34Z", "7cfbf1a5"),
    ]);
    expect(pendingBuildCommits(HISTORY, builds)).toEqual([]);
    expect(
      evaluateDeploymentOrdering({
        history: HISTORY,
        builds,
        liveVersion: OLDER,
      }),
    ).toMatchObject({
      status: "superseded",
      liveBuildCompletedAt: "2026-10-21T06:25:44Z",
      expectedBuildCompletedAt: "2026-10-21T06:25:34Z",
    });
  });

  it("waits while any observed commit still has a build that can publish", () => {
    const builds = [
      running(OLDER),
      completed(NEWER, "success", "2026-10-21T06:25:34Z"),
    ];
    expect(pendingBuildCommits(HISTORY, builds)).toEqual([OLDER]);
    expect(
      evaluateDeploymentOrdering({
        history: HISTORY,
        builds,
        liveVersion: NEWER,
      }),
    ).toEqual({ status: "pending", pendingCommits: [OLDER] });
  });

  it("waits for a queued retry of a commit that already built successfully", () => {
    expect(
      pendingBuildCommits(HISTORY, [
        completed(OLDER, "success", "2026-10-21T06:25:20Z"),
        running(OLDER, "queued"),
        completed(NEWER, "success", "2026-10-21T06:25:34Z"),
      ]),
    ).toEqual([OLDER]);
  });

  it("reports unverified rather than verified when production has no commit marker", () => {
    const verdict = evaluateDeploymentOrdering({
      history: HISTORY,
      builds: [completed(NEWER, "success", "2026-10-21T06:25:34Z")],
      liveVersion: "1792565237799",
    });
    expect(verdict).toMatchObject({ status: "inconclusive" });
    expect(formatOrderingReport(verdict)).toMatchObject({
      level: "error",
      failed: true,
    });
  });

  it("reports unverified when the delivered commit is outside the observed history", () => {
    expect(
      evaluateDeploymentOrdering({
        history: HISTORY,
        builds: [completed(NEWER, "success", "2026-10-21T06:25:34Z")],
        liveVersion: NEWEST,
      }),
    ).toMatchObject({ status: "inconclusive" });
  });

  it("reports an unfailed warning when production is ahead of the build evidence", () => {
    const verdict = evaluateDeploymentOrdering({
      history: HISTORY,
      builds: [completed(OLDER, "success", "2026-10-21T06:25:20Z")],
      liveVersion: NEWER,
    });
    expect(verdict).toEqual({
      status: "ahead",
      liveCommit: NEWER,
      expectedCommit: OLDER,
    });
    expect(formatOrderingReport(verdict)).toMatchObject({
      level: "warning",
      failed: false,
    });
  });
});

type Observation = { builds: BuildCheck[]; liveVersion: string | null };

function watchDependencies(
  observations: Observation[],
  history: string[] = HISTORY,
) {
  let clock = 0;
  let index = 0;
  const current = () =>
    observations[Math.min(index, observations.length - 1)] as Observation;
  const deps: OrderingWatchDeps = {
    readHistory: async () => history,
    readBuilds: async () => current().builds,
    readLiveVersion: async () => current().liveVersion,
    sleep: async (seconds) => {
      clock += seconds * 1_000;
      index += 1;
    },
    now: () => clock,
  };
  return deps;
}

describe("deployment ordering watch", () => {
  it("catches the older build that publishes after the newer commit is already live", async () => {
    // The newer commit is live and its build has finished, but the older
    // commit is still building: reading production now would pass while the
    // build that overwrites it is still in flight.
    const deps = watchDependencies([
      {
        builds: [
          running(OLDER),
          completed(NEWER, "success", "2026-10-21T06:25:34Z"),
        ],
        liveVersion: NEWER,
      },
      {
        builds: [
          running(OLDER),
          completed(NEWER, "success", "2026-10-21T06:25:34Z"),
        ],
        liveVersion: NEWER,
      },
      {
        builds: [
          completed(OLDER, "success", "2026-10-21T06:25:44Z"),
          completed(NEWER, "success", "2026-10-21T06:25:34Z"),
        ],
        liveVersion: OLDER,
      },
    ]);

    await expect(watchDeploymentOrdering(deps)).resolves.toMatchObject({
      status: "superseded",
      liveCommit: OLDER,
      expectedCommit: NEWER,
    });
  });

  it("verifies the delivered commit once every build has finished", async () => {
    const deps = watchDependencies([
      {
        builds: [
          completed(OLDER, "success", "2026-10-21T06:25:20Z"),
          completed(NEWER, "success", "2026-10-21T06:25:34Z"),
        ],
        liveVersion: NEWER,
      },
    ]);

    await expect(watchDeploymentOrdering(deps)).resolves.toEqual({
      status: "verified",
      commit: NEWER,
    });
  });

  it("does not fail on a single read taken while the edge is still switching versions", async () => {
    const settled = [
      completed(OLDER, "success", "2026-10-21T06:25:20Z"),
      completed(NEWER, "success", "2026-10-21T06:25:34Z"),
    ];
    const deps = watchDependencies([
      { builds: settled, liveVersion: OLDER },
      { builds: settled, liveVersion: OLDER },
      { builds: settled, liveVersion: NEWER },
    ]);

    await expect(watchDeploymentOrdering(deps)).resolves.toEqual({
      status: "verified",
      commit: NEWER,
    });
  });

  it("keeps waiting when a retried build starts during the settle interval", async () => {
    const settled = [
      completed(OLDER, "success", "2026-10-21T06:25:20Z"),
      completed(NEWER, "success", "2026-10-21T06:25:34Z"),
    ];
    const deps = watchDependencies([
      { builds: settled, liveVersion: NEWER },
      { builds: [...settled, running(OLDER)], liveVersion: NEWER },
      {
        builds: [
          ...settled,
          completed(OLDER, "success", "2026-10-21T07:10:02Z"),
        ],
        liveVersion: OLDER,
      },
    ]);

    await expect(watchDeploymentOrdering(deps)).resolves.toMatchObject({
      status: "superseded",
      liveCommit: OLDER,
      liveBuildCompletedAt: "2026-10-21T07:10:02Z",
    });
  });

  it("reports unverified instead of passing when a build never finishes", async () => {
    const deps = watchDependencies([
      { builds: [running(NEWER)], liveVersion: OLDER },
    ]);

    const verdict = await watchDeploymentOrdering(deps, {
      ...DEFAULT_WATCH_OPTIONS,
      deadlineSeconds: 60,
    });
    expect(verdict).toMatchObject({ status: "inconclusive" });
    expect(formatOrderingReport(verdict)).toMatchObject({
      level: "error",
      failed: true,
    });
  });
});
