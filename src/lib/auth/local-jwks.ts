import { getCloudflareRuntimeContext } from "@/lib/adapters/cloudflare-runtime";

async function fetchLocalJwks() {
  const { authApi } = await import("@/lib/auth/core");
  return authApi.getJwks({});
}

/** Cache public signing keys per auth database; authorization stays uncached. */
export function getLocalJwksVerificationOptions() {
  return {
    jwksFetch: fetchLocalJwks,
    // Better Auth owns the bounded TTL and refresh on an unfamiliar key id.
    // No binding means no stable keyring identity, so leave caching disabled.
    jwksCacheKey: getCloudflareRuntimeContext()?.env?.HYPERDRIVE_AUTH,
  };
}
