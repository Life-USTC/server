import { describe, expect, it } from "vitest";
import { loadEnv } from "@/lib/adapters/cloudflare-env";
import { runWithCloudflareRuntimeEnv } from "@/lib/adapters/cloudflare-runtime";

describe("Cloudflare environment parsing", () => {
  it("reuses validated environment data within one request only", async () => {
    const firstRequest = await runWithCloudflareRuntimeEnv(
      {
        AUTH_SECRET: "request-one-secret",
        HYPERDRIVE: { connectionString: "postgresql://example.test/one" },
        NODE_ENV: "production",
      },
      () => [loadEnv(), loadEnv()],
    );
    const secondRequest = await runWithCloudflareRuntimeEnv(
      {
        AUTH_SECRET: "request-two-secret",
        HYPERDRIVE: { connectionString: "postgresql://example.test/two" },
        NODE_ENV: "production",
      },
      () => loadEnv(),
    );

    expect(firstRequest[0]).toBe(firstRequest[1]);
    expect(firstRequest[0]).not.toBe(secondRequest);
    expect(firstRequest[0]?.AUTH_SECRET).toBe("request-one-secret");
    expect(secondRequest.AUTH_SECRET).toBe("request-two-secret");
  });
});
