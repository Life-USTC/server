import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

type RateLimitBinding = {
  name: string;
  namespace_id: string;
  simple: { limit: number; period: number };
};

async function readRateLimits(fileName: string): Promise<RateLimitBinding[]> {
  const source = await readFile(new URL(`../../${fileName}`, import.meta.url));
  const config = JSON.parse(source.toString()) as {
    ratelimits?: RateLimitBinding[];
  };
  return config.ratelimits ?? [];
}

describe("Wrangler mutation rate-limit bindings", () => {
  it.each(["wrangler.jsonc", "wrangler.e2e.jsonc"])(
    "routes application requests through the gateway while keeping static assets direct in %s",
    async (fileName) => {
      const source = await readFile(
        new URL(`../../${fileName}`, import.meta.url),
        "utf8",
      );
      const config = JSON.parse(source) as {
        assets?: { run_worker_first?: string[] };
      };

      expect(config.assets?.run_worker_first).toEqual([
        "/*",
        "!/_app/*",
        "!/images/*",
        "!/static/*",
        "!/openapi.generated.json",
      ]);
    },
  );

  it("disables platform URL-bearing traces while retaining custom logs", async () => {
    const source = await readFile(
      new URL("../../wrangler.jsonc", import.meta.url),
      "utf8",
    );
    const config = JSON.parse(source) as {
      observability?: {
        logs?: {
          enabled?: boolean;
          head_sampling_rate?: number;
          invocation_logs?: boolean;
          persist?: boolean;
        };
        traces?: { enabled?: boolean };
      };
      preview_urls?: boolean;
      workers_dev?: boolean;
      compatibility_date?: string;
    };

    expect(config.preview_urls).toBe(false);
    expect(config.workers_dev).toBe(false);
    expect(config.observability?.logs?.enabled).toBe(true);
    expect(config.observability?.logs?.invocation_logs).toBe(false);
    expect(config.observability?.logs?.head_sampling_rate).toBe(1);
    expect(config.observability?.logs?.persist).toBe(true);
    expect(config.observability?.traces?.enabled).toBe(false);
  });

  it("uploads production source maps for exception symbolication", async () => {
    const source = await readFile(
      new URL("../../wrangler.jsonc", import.meta.url),
      "utf8",
    );
    const config = JSON.parse(source) as { upload_source_maps?: boolean };

    expect(config.upload_source_maps).toBe(true);
  });

  it("routes production CIMD fetches through the public Internet boundary", async () => {
    const source = await readFile(
      new URL("../../wrangler.jsonc", import.meta.url),
      "utf8",
    );
    const config = JSON.parse(source) as { compatibility_flags?: string[] };

    expect(config.compatibility_flags).toContain(
      "global_fetch_strictly_public",
    );
  });

  it("keeps production budgets at 60 standard and 10 batch writes per minute", async () => {
    await expect(readRateLimits("wrangler.jsonc")).resolves.toEqual([
      {
        name: "USER_WRITE_RATE_LIMITER",
        namespace_id: "414001",
        simple: { limit: 60, period: 60 },
      },
      {
        name: "USER_BATCH_WRITE_RATE_LIMITER",
        namespace_id: "414002",
        simple: { limit: 10, period: 60 },
      },
    ]);
  });

  it("keeps E2E bindings enabled without throttling shared fixture users", async () => {
    await expect(readRateLimits("wrangler.e2e.jsonc")).resolves.toEqual([
      {
        name: "USER_WRITE_RATE_LIMITER",
        namespace_id: "414001",
        simple: { limit: 10000, period: 60 },
      },
      {
        name: "USER_BATCH_WRITE_RATE_LIMITER",
        namespace_id: "414002",
        simple: { limit: 10000, period: 60 },
      },
    ]);
  });
});
