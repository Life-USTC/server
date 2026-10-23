import { z } from "zod";
import { PRODUCTION_VERSION_MARKER_PATH } from "./deployment-ordering";
import type {
  PromotionCandidate,
  PromotionState,
} from "./production-promotion";

export const candidateSchema = z.strictObject({
  commit: z.string().regex(/^[0-9a-f]{40}$/),
  version: z.uuid(),
});

export type PromotionEnvironment = {
  CLOUDFLARE_ACCOUNT_ID: string;
  CLOUDFLARE_API_TOKEN: string;
  GITHUB_REPOSITORY: string;
  GITHUB_TOKEN: string;
  WORKER_NAME: string;
  APP_PUBLIC_ORIGIN: string;
};

const deploymentSchema = z.object({
  id: z.uuid(),
  versions: z.array(z.object({ version_id: z.uuid(), percentage: z.number() })),
  annotations: z
    .object({ "workers/message": z.string().optional() })
    .optional(),
});

function hasVersion(
  deployment: z.infer<typeof deploymentSchema>,
  version: string,
) {
  return (
    deployment.versions.length === 1 &&
    deployment.versions[0]?.version_id === version &&
    deployment.versions[0]?.percentage === 100
  );
}

export function promotionEvidence(env: PromotionEnvironment) {
  const workerPath = `/accounts/${encodeURIComponent(env.CLOUDFLARE_ACCOUNT_ID)}/workers/scripts/${encodeURIComponent(env.WORKER_NAME)}`;

  async function cloudflare(path: string, body?: unknown) {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4${workerPath}${path}`,
      {
        method: body === undefined ? "GET" : "POST",
        headers: {
          authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
          "content-type": "application/json",
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(15_000),
        redirect: "manual",
      },
    );
    if (!response.ok)
      throw new Error(`Cloudflare returned HTTP ${response.status}.`);
    return z
      .object({ success: z.literal(true), result: z.unknown() })
      .parse(await response.json()).result;
  }

  async function github(path: string) {
    const response = await fetch(
      `https://api.github.com/repos/${env.GITHUB_REPOSITORY}${path}`,
      {
        headers: {
          authorization: `Bearer ${env.GITHUB_TOKEN}`,
          accept: "application/vnd.github+json",
          "x-github-api-version": "2022-11-28",
          "user-agent": "life-ustc-production-promotion",
        },
        signal: AbortSignal.timeout(15_000),
        redirect: "manual",
      },
    );
    if (!response.ok)
      throw new Error(`GitHub returned HTTP ${response.status}.`);
    return response.json();
  }

  async function readHistory(delivered: string) {
    const history: string[] = [];
    let ref = "main";
    // A missing baseline or rewritten main must stop promotion, not silently
    // turn the oldest available API page into a new ordering baseline.
    for (let depth = 0; depth < 100; depth++) {
      const commit = z
        .object({
          sha: candidateSchema.shape.commit,
          parents: z.array(z.object({ sha: candidateSchema.shape.commit })),
        })
        .parse(await github(`/commits/${ref}`));
      if (ref !== "main" && commit.sha !== ref)
        throw new Error("Git history identity differs.");
      history.push(commit.sha);
      if (commit.sha === delivered) return history;
      const parent = commit.parents[0]?.sha;
      if (!parent) break;
      ref = parent;
    }
    throw new Error("Delivered commit is outside the observed main history.");
  }

  async function verifyCandidate(candidate: PromotionCandidate) {
    const version = z
      .object({
        id: z.uuid(),
        annotations: z.object({ "workers/tag": candidateSchema.shape.commit }),
      })
      .parse(await cloudflare(`/versions/${candidate.version}`));
    if (
      version.id !== candidate.version ||
      version.annotations["workers/tag"] !== candidate.commit
    ) {
      throw new Error("Uploaded version does not match the candidate commit.");
    }
  }

  async function sourceCi(
    commit: string,
  ): Promise<"ready" | "waiting" | "failed"> {
    const payload = z
      .object({
        workflow_runs: z.array(
          z.object({
            id: z.number().int().positive(),
            head_sha: z.string(),
            head_branch: z.string().nullable(),
            event: z.string(),
            path: z.string(),
            status: z.string(),
            conclusion: z.string().nullable(),
          }),
        ),
      })
      .parse(
        await github(
          `/actions/workflows/ci.yml/runs?head_sha=${commit}&branch=main&event=push&per_page=1`,
        ),
      );
    const run = payload.workflow_runs[0];
    if (!run) return "waiting";
    if (
      run.head_sha !== commit ||
      run.head_branch !== "main" ||
      run.event !== "push" ||
      run.path !== ".github/workflows/ci.yml"
    )
      throw new Error("Source CI identity differs from the candidate.");
    if (run.status !== "completed") return "waiting";
    if (run.conclusion !== "success") return "failed";
    for (let page = 1; page <= 10; page++) {
      const jobs = z
        .object({
          jobs: z.array(
            z.object({
              name: z.string(),
              status: z.string(),
              conclusion: z.string().nullable(),
              head_sha: z.string(),
            }),
          ),
        })
        .parse(
          await github(
            `/actions/runs/${run.id}/jobs?filter=latest&per_page=100&page=${page}`,
          ),
        );
      const evidence = jobs.jobs.find(
        (job) => job.name === "Specification execution evidence / run",
      );
      if (evidence) {
        if (evidence.head_sha !== commit)
          throw new Error("CI aggregate belongs to another commit.");
        if (evidence.status !== "completed") return "waiting";
        return evidence.conclusion === "success" ? "ready" : "failed";
      }
      if (jobs.jobs.length < 100) break;
    }
    throw new Error("Source CI has no specification execution evidence.");
  }

  async function currentDeployment() {
    const response = z
      .object({ deployments: z.array(deploymentSchema) })
      .parse(await cloudflare("/deployments"));
    const current = response.deployments[0];
    if (!current) throw new Error("No current deployment was observed.");
    return current;
  }

  async function liveCommit() {
    const response = await fetch(
      new URL(PRODUCTION_VERSION_MARKER_PATH, env.APP_PUBLIC_ORIGIN),
      {
        cache: "no-store",
        headers: { "cache-control": "no-cache" },
        signal: AbortSignal.timeout(15_000),
        redirect: "manual",
      },
    );
    if (!response.ok)
      throw new Error(`Version marker returned HTTP ${response.status}.`);
    return z
      .object({ version: candidateSchema.shape.commit })
      .parse(await response.json()).version;
  }

  return {
    verifyCandidate,
    async verifyRegistration(candidate: PromotionCandidate) {
      await verifyCandidate(candidate);
      await readHistory(candidate.commit);
    },
    async verifyBaseline(candidate: PromotionCandidate) {
      await readHistory(candidate.commit);
      if (
        !hasVersion(await currentDeployment(), candidate.version) ||
        (await liveCommit()) !== candidate.commit
      ) {
        throw new Error("Baseline differs from the current deployment.");
      }
    },
    async readEvidence(state: PromotionState) {
      // An external publisher or manual rollback invalidates the recorded
      // baseline. Observing it is not permission to overwrite it automatically.
      if (
        !hasVersion(await currentDeployment(), state.delivered.version) ||
        (await liveCommit()) !== state.delivered.commit
      ) {
        throw new Error(
          "Production differs from the recorded delivered version.",
        );
      }
      const history = await readHistory(state.delivered.commit);
      const ready: PromotionCandidate[] = [];
      const waiting: string[] = [];
      for (const candidate of state.candidates) {
        const index = history.indexOf(candidate.commit);
        if (index < 0 || index >= history.length - 1) continue;
        await verifyCandidate(candidate);
        const ci = await sourceCi(candidate.commit);
        if (ci === "ready") ready.push(candidate);
        if (ci === "waiting") waiting.push(candidate.commit);
      }
      return { history, ready, waiting };
    },
    async publish({
      candidate,
      operationId,
    }: {
      candidate: PromotionCandidate;
      operationId: string;
    }) {
      const deployment = deploymentSchema.parse(
        await cloudflare("/deployments", {
          strategy: "percentage",
          versions: [{ version_id: candidate.version, percentage: 100 }],
          annotations: {
            "workers/message": `${operationId}:${candidate.commit}`,
          },
        }),
      );
      if (!hasVersion(deployment, candidate.version))
        throw new Error("Deployment response differs from the candidate.");
      return deployment.id;
    },
    async isDelivered(pending: {
      candidate: PromotionCandidate;
      operationId: string;
      deployment: string;
    }) {
      const current = await currentDeployment();
      return (
        current.id === pending.deployment &&
        current.annotations?.["workers/message"] ===
          `${pending.operationId}:${pending.candidate.commit}` &&
        hasVersion(current, pending.candidate.version) &&
        (await liveCommit()) === pending.candidate.commit
      );
    },
  };
}
