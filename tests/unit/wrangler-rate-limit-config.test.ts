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
  it("uploads production source maps for trace and exception symbolication", async () => {
    const source = await readFile(
      new URL("../../wrangler.jsonc", import.meta.url),
      "utf8",
    );
    const config = JSON.parse(source) as { upload_source_maps?: boolean };

    expect(config.upload_source_maps).toBe(true);
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
