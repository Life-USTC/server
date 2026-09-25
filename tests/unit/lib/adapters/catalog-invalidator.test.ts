import { describe, expect, it, vi } from "vitest";
import {
  invalidateCloudflareCatalogRepresentations,
  runWithCloudflareRuntimeEnv,
  setCloudflareCatalogInvalidator,
} from "@/lib/adapters/cloudflare-runtime";

describe("catalog representation invalidation", () => {
  it("inherits the Worker RPC callback through the nested SvelteKit runtime", async () => {
    const purge = vi.fn(async () => {});
    await runWithCloudflareRuntimeEnv({}, async () => {
      setCloudflareCatalogInvalidator(purge);
      await runWithCloudflareRuntimeEnv(
        {},
        invalidateCloudflareCatalogRepresentations,
      );
    });
    expect(purge).toHaveBeenCalledOnce();
  });
  it("fails loudly when a Worker request has no invalidator", async () => {
    await expect(
      runWithCloudflareRuntimeEnv(
        {},
        invalidateCloudflareCatalogRepresentations,
      ),
    ).rejects.toThrow("invalidator is unavailable");
  });
  it("allows the local Vite development profile without a Worker HTML cache", async () => {
    await expect(
      runWithCloudflareRuntimeEnv(
        { NODE_ENV: "development" },
        invalidateCloudflareCatalogRepresentations,
      ),
    ).resolves.toBeUndefined();
  });
  it("does not need an invalidator outside a Worker runtime", async () => {
    await expect(
      invalidateCloudflareCatalogRepresentations(),
    ).resolves.toBeUndefined();
  });
});
