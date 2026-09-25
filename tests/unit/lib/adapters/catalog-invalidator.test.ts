import { describe, expect, it, vi } from "vitest";
import {
  invalidateCloudflareCatalogRepresentations,
  runWithCloudflareRuntimeEnv,
  setCloudflareCatalogInvalidator,
} from "@/lib/adapters/cloudflare-runtime";

describe("catalog representation invalidation", () => {
  it("inherits an explicitly injected invalidator through nested runtime scopes", async () => {
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
  it.each([true, false])(
    "reconstructs the RPC from platform context without an outer runtime (success=%s)",
    async (ok) => {
      const purge = vi
        .fn()
        .mockResolvedValue(
          ok ? { ok: true } : { ok: false, reason: "purge-rejected" },
        );
      const PublicSsr = vi.fn(() => ({ purgeCatalogRepresentations: purge }));
      // Loopback stubs expose properties as RPC methods, not Function.prototype.
      Object.defineProperty(PublicSsr, "call", {
        get() {
          throw new Error("Unexpected RPC method: call");
        },
      });
      const result = runWithCloudflareRuntimeEnv(
        { NODE_ENV: "production" },
        invalidateCloudflareCatalogRepresentations,
        { exports: { PublicSsr }, waitUntil: vi.fn() },
      );
      if (ok) await expect(result).resolves.toBeUndefined();
      else await expect(result).rejects.toThrow("purge-rejected");
      expect(PublicSsr).toHaveBeenCalledExactlyOnceWith({});
      expect(purge).toHaveBeenCalledOnce();
    },
  );
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
