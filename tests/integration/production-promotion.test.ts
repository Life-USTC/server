import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { Miniflare, type Request, Response } from "miniflare";
import { afterAll, beforeAll, expect, test } from "vitest";
import type {
  PromotionCandidate,
  PromotionState,
} from "../../scripts/deploy/production-promotion";

const BASE = {
  commit: "1".repeat(40),
  version: "00000000-0000-4000-8000-000000000001",
};
const A = {
  commit: "a".repeat(40),
  version: "00000000-0000-4000-8000-000000000002",
};
const B = {
  commit: "b".repeat(40),
  version: "00000000-0000-4000-8000-000000000003",
};
const token = "local-promotion-contract-secret-32-characters";
const readToken = "local-promotion-observer-secret-32-characters";
let source: string;
let buildDirectory: string;

beforeAll(async () => {
  buildDirectory = await mkdtemp(join(tmpdir(), "promotion-contract-build-"));
  const file = join(buildDirectory, "worker.js");
  await promisify(execFile)("bun", [
    "build",
    "scripts/deploy/promotion-worker.ts",
    "--target=browser",
    "--outfile",
    file,
  ]);
  source = await readFile(file, "utf8");
});

afterAll(async () => {
  if (buildDirectory)
    await rm(buildDirectory, { recursive: true, force: true });
});

function externalEvidence() {
  const state = {
    live: BASE,
    deployment: "10000000-0000-4000-8000-000000000001",
    message: "baseline",
    published: [] as PromotionCandidate[],
    ready: new Set([A.commit, B.commit]),
    pendingCi: false,
    wrongCiCommit: false,
    missingAggregate: false,
    wrongTag: false,
    losePublishResponse: false,
  };
  const json = (value: unknown) => Response.json(value);
  async function fetch(request: Request) {
    const url = new URL(request.url);
    if (url.hostname === "production.example")
      return json({ version: state.live.commit });
    if (url.hostname === "api.cloudflare.com") {
      expect(request.headers.get("authorization")).toBe(
        "Bearer cloudflare-contract-token",
      );
      const versionId = url.pathname.match(/\/versions\/([^/]+)$/)?.[1];
      if (versionId) {
        const candidate = [BASE, A, B].find(
          (candidate) => candidate.version === versionId,
        );
        return json({
          success: true,
          result: {
            id: versionId,
            annotations: {
              "workers/tag": state.wrongTag ? BASE.commit : candidate?.commit,
            },
          },
        });
      }
      if (url.pathname.endsWith("/deployments")) {
        if (request.method === "POST") {
          const body = (await request.json()) as {
            versions: { version_id: string }[];
            annotations: { "workers/message": string };
          };
          const candidate = [A, B].find(
            (candidate) => candidate.version === body.versions[0]?.version_id,
          );
          if (!candidate) throw new Error("Unexpected production candidate.");
          state.published.push(candidate);
          state.live = candidate;
          state.deployment = `10000000-0000-4000-8000-${String(state.published.length + 1).padStart(12, "0")}`;
          state.message = body.annotations["workers/message"];
          if (state.losePublishResponse)
            return new Response("Lost accepted response", { status: 502 });
        }
        const deployment = {
          id: state.deployment,
          versions: [{ version_id: state.live.version, percentage: 100 }],
          annotations: { "workers/message": state.message },
        };
        return json({
          success: true,
          result:
            request.method === "POST"
              ? deployment
              : { deployments: [deployment] },
        });
      }
    }
    if (url.hostname === "api.github.com") {
      expect(request.headers.get("authorization")).toBe(
        "Bearer github-contract-token",
      );
      const ref = url.pathname.match(/\/commits\/([^/]+)$/)?.[1];
      if (ref) {
        const sha = ref === "main" ? B.commit : ref;
        return json({
          sha,
          parents:
            sha === B.commit
              ? [{ sha: A.commit }]
              : sha === A.commit
                ? [{ sha: BASE.commit }]
                : [],
        });
      }
      if (url.pathname.endsWith("/actions/workflows/ci.yml/runs")) {
        const commit = url.searchParams.get("head_sha");
        return json({
          workflow_runs: [
            {
              id: commit === A.commit ? 11 : 12,
              head_sha: state.wrongCiCommit ? BASE.commit : commit,
              head_branch: "main",
              event: "push",
              path: ".github/workflows/ci.yml",
              status: state.pendingCi ? "in_progress" : "completed",
              conclusion: state.pendingCi
                ? null
                : state.ready.has(commit ?? "")
                  ? "success"
                  : "failure",
            },
          ],
        });
      }
      const run = url.pathname.match(/\/actions\/runs\/(\d+)\/jobs$/)?.[1];
      if (run)
        return json({
          jobs: state.missingAggregate
            ? []
            : [
                {
                  name: "Specification execution evidence / run",
                  head_sha: run === "11" ? A.commit : B.commit,
                  status: "completed",
                  conclusion: "success",
                },
              ],
        });
    }
    throw new Error(
      `Unexpected evidence request: ${url.hostname}${url.pathname}`,
    );
  }
  return { state, fetch };
}

type Runtime = {
  external: ReturnType<typeof externalEvidence>["state"];
  request(
    path: string,
    candidate?: PromotionCandidate,
    authorized?: boolean | "observer",
  ): Promise<Response>;
  state(): Promise<PromotionState>;
  restart(enabled?: boolean, observerToken?: string): Promise<void>;
};

const runtimeTest = test.extend<{ promotion: Runtime }>({
  // biome-ignore lint/correctness/noEmptyPattern: Native fixture has no dependencies.
  promotion: async ({}, use) => {
    const directory = await mkdtemp(
      join(tmpdir(), "promotion-contract-state-"),
    );
    const external = externalEvidence();
    let runtime: Miniflare | undefined;
    const start = async (enabled = false, observerToken = readToken) => {
      runtime = new Miniflare({
        resourcePersistencePath: directory,
        workers: [
          {
            config: {
              name: "promotion-contract",
              compatibilityDate: "2026-07-23",
              manifest: {
                mainModule: "worker.js",
                modulesRoot: "/",
                modules: { "worker.js": { type: "esm", contents: source } },
              },
              exports: {
                ProductionPromotion: {
                  type: "durable-object",
                  storage: "sqlite",
                },
              },
              env: {
                PROMOTION: {
                  type: "durable-object",
                  worker: "promotion-contract",
                  exportName: "ProductionPromotion",
                },
                ...Object.fromEntries(
                  Object.entries({
                    PROMOTION_TOKEN: token,
                    PROMOTION_READ_TOKEN: observerToken,
                    PROMOTION_ENABLED: String(enabled),
                    CLOUDFLARE_ACCOUNT_ID: "contract-account",
                    CLOUDFLARE_API_TOKEN: "cloudflare-contract-token",
                    GITHUB_REPOSITORY: "Life-USTC/server",
                    GITHUB_TOKEN: "github-contract-token",
                    WORKER_NAME: "life-ustc",
                    APP_PUBLIC_ORIGIN: "https://production.example",
                  }).map(([key, value]) => [
                    key,
                    { type: "json" as const, value },
                  ]),
                ),
              },
            },
            dev: {
              outboundService: { type: "fetcher", handler: external.fetch },
            },
          },
        ],
      });
      await runtime.ready;
    };
    const request: Runtime["request"] = (
      path,
      candidate,
      authorized = true,
    ) => {
      if (!runtime) throw new Error("Runtime is unavailable.");
      return runtime.dispatchFetch(`https://promotion.example${path}`, {
        method: path === "/state" || path === "/status" ? "GET" : "POST",
        headers: {
          ...(authorized
            ? {
                authorization: `Bearer ${authorized === "observer" ? readToken : token}`,
              }
            : {}),
          "content-type": "application/json",
        },
        ...(candidate ? { body: JSON.stringify(candidate) } : {}),
      });
    };
    try {
      await start();
      await use({
        external: external.state,
        request,
        state: async () =>
          (await (await request("/state")).json()) as PromotionState,
        restart: async (enabled = true, observerToken = readToken) => {
          await runtime?.dispose();
          await start(enabled, observerToken);
        },
      });
    } finally {
      await runtime?.dispose();
      await rm(directory, { recursive: true, force: true });
    }
  },
});

runtimeTest(
  "observer credential can read status but cannot initialize, register or publish",
  { tags: ["@Infrastructure/Runtime"] },
  async ({ promotion }) => {
    for (const path of ["/initialize", "/candidates", "/reconcile", "/state"]) {
      expect(
        (
          await promotion.request(
            path,
            path === "/state" ? undefined : A,
            "observer",
          )
        ).status,
      ).toBe(401);
    }
    expect((await promotion.request("/initialize", BASE)).status).toBe(201);
    expect(
      await (await promotion.request("/status", undefined, "observer")).json(),
    ).toEqual({ status: "disabled", commit: BASE.commit });
    await promotion.restart();
    expect(
      await (await promotion.request("/status", undefined, "observer")).json(),
    ).toEqual({ status: "settled", commit: BASE.commit });
    expect(promotion.external.published).toEqual([]);
    expect((await promotion.state()).candidates).toEqual([]);
  },
);

runtimeTest(
  "identical observer and writer credentials disable every publication endpoint",
  { tags: ["@Infrastructure/Runtime"] },
  async ({ promotion }) => {
    await promotion.request("/initialize", BASE);
    await promotion.restart(true, token);
    for (const path of [
      "/initialize",
      "/candidates",
      "/reconcile",
      "/status",
    ]) {
      expect(
        (await promotion.request(path, path === "/status" ? undefined : A))
          .status,
      ).toBe(503);
    }
    expect(promotion.external.published).toEqual([]);
    await promotion.restart();
    expect((await promotion.state()).delivered).toEqual(BASE);
    expect((await promotion.state()).candidates).toEqual([]);
  },
);

runtimeTest(
  "observer waits for unfinished source CI and preserves terminal failed candidates",
  { tags: ["@Infrastructure/Runtime"] },
  async ({ promotion }) => {
    await promotion.request("/initialize", BASE);
    await promotion.request("/candidates", A);
    promotion.external.ready.delete(A.commit);
    await promotion.restart();
    await promotion.request("/reconcile");
    expect(
      await (await promotion.request("/status", undefined, "observer")).json(),
    ).toEqual({ status: "settled", commit: BASE.commit });
    expect(promotion.external.published).toEqual([]);
    expect((await promotion.state()).candidates).toEqual([A]);

    promotion.external.pendingCi = true;
    await promotion.request("/reconcile");
    expect(
      await (await promotion.request("/status", undefined, "observer")).json(),
    ).toEqual({ status: "pending", commit: BASE.commit });
    expect(promotion.external.published).toEqual([]);

    promotion.external.pendingCi = false;
    promotion.external.ready.add(A.commit);
    await promotion.request("/reconcile");
    expect(
      await (await promotion.request("/status", undefined, "observer")).json(),
    ).toEqual({ status: "settled", commit: A.commit });
    expect(promotion.external.published).toEqual([A]);
  },
);

runtimeTest(
  "production promotion persists ordering through a real Durable Object restart",
  { tags: ["@Infrastructure/Runtime"] },
  async ({ promotion }) => {
    expect((await promotion.request("/initialize", BASE)).status).toBe(201);
    expect((await promotion.request("/candidates", B)).status).toBe(202);
    expect((await promotion.request("/candidates", A)).status).toBe(202);
    await promotion.restart();
    await promotion.request("/reconcile");
    expect((await promotion.state()).delivered).toEqual(B);
    await promotion.request("/reconcile");
    expect((await promotion.state()).candidates).toEqual([]);
    await promotion.request("/candidates", A);
    expect((await promotion.state()).candidates).toEqual([A]);
    await promotion.request("/reconcile");
    expect(promotion.external.published).toEqual([B]);
    expect(promotion.external.live).toEqual(B);
    expect((await promotion.state()).candidates).toEqual([]);
  },
);

runtimeTest(
  "registered candidate and its alarm survive restart without another request",
  { tags: ["@Infrastructure/Runtime"] },
  async ({ promotion }) => {
    expect((await promotion.request("/initialize", BASE)).status).toBe(201);
    expect((await promotion.request("/candidates", A)).status).toBe(202);
    await promotion.restart();
    await expect
      .poll(() => promotion.external.live, { timeout: 5_000 })
      .toEqual(A);
    await expect
      .poll(async () => (await promotion.state()).delivered, { timeout: 5_000 })
      .toEqual(A);
    expect(promotion.external.published).toEqual([A]);
  },
);

runtimeTest(
  "unknown accepted publication stays blocked after restart and a later candidate",
  { tags: ["@Infrastructure/Runtime"] },
  async ({ promotion }) => {
    await promotion.request("/initialize", BASE);
    await promotion.request("/candidates", A);
    promotion.external.losePublishResponse = true;
    await promotion.restart();
    await promotion.request("/reconcile");
    expect((await promotion.state()).pending).toMatchObject({
      phase: "publishing",
      candidate: A,
    });
    expect(promotion.external.live).toEqual(A);
    await promotion.restart();
    await promotion.request("/candidates", B);
    await promotion.request("/reconcile");
    expect(promotion.external.published).toEqual([A]);
    expect((await promotion.state()).delivered).toEqual(BASE);
    expect((await promotion.state()).pending).toMatchObject({
      phase: "publishing",
      candidate: A,
    });
  },
);

runtimeTest(
  "disabled and unauthenticated promotion cannot publish",
  { tags: ["@Infrastructure/Runtime"] },
  async ({ promotion }) => {
    expect((await promotion.request("/initialize", BASE, false)).status).toBe(
      401,
    );
    expect(await (await promotion.request("/state")).json()).toBeNull();
    await promotion.request("/initialize", BASE);
    await promotion.request("/candidates", A);
    expect(await (await promotion.request("/reconcile")).json()).toEqual({
      status: "disabled",
    });
    expect(promotion.external.published).toEqual([]);
    expect((await promotion.request("/initialize", B)).status).toBe(409);
  },
);

runtimeTest(
  "version identity and complete exact-commit CI evidence gate production",
  { tags: ["@Infrastructure/Runtime"] },
  async ({ promotion }) => {
    await promotion.request("/initialize", BASE);
    promotion.external.wrongTag = true;
    expect((await promotion.request("/candidates", A)).status).toBe(503);
    expect((await promotion.state()).candidates).toEqual([]);
    promotion.external.wrongTag = false;
    await promotion.request("/candidates", A);
    promotion.external.wrongCiCommit = true;
    await promotion.restart();
    await promotion.request("/reconcile");
    expect(promotion.external.published).toEqual([]);
    promotion.external.wrongCiCommit = false;
    promotion.external.missingAggregate = true;
    await promotion.request("/reconcile");
    expect(promotion.external.published).toEqual([]);
    promotion.external.missingAggregate = false;
    await promotion.request("/reconcile");
    expect(promotion.external.published).toEqual([A]);
  },
);

runtimeTest(
  "manual production changes are not overwritten using a stale baseline",
  { tags: ["@Infrastructure/Runtime"] },
  async ({ promotion }) => {
    await promotion.request("/initialize", BASE);
    await promotion.request("/candidates", B);
    promotion.external.live = A;
    await promotion.restart();
    expect((await promotion.request("/reconcile")).status).toBe(503);
    expect(promotion.external.published).toEqual([]);
    expect((await promotion.state()).delivered).toEqual(BASE);
  },
);
