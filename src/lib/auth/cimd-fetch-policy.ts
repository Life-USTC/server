import { resolve4, resolve6 } from "node:dns/promises";
import { isIP } from "node:net";
import { isPublicRoutableHost } from "@better-auth/core/utils/host";
import type { ClientMetadataResourceFetch } from "@better-auth/oauth-provider";

function isNoAddressError(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return false;
  return ["ENODATA", "ENOTFOUND", "EAI_NODATA"].includes(String(error.code));
}

async function resolveAddresses(
  resolver: (hostname: string) => Promise<string[]>,
  hostname: string,
) {
  try {
    return await resolver(hostname);
  } catch (error) {
    if (isNoAddressError(error)) return [];
    throw error;
  }
}

export async function allowCimdMetadataFetch(url: string) {
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return false;
  }

  const unwrappedHostname = hostname.replace(/^\[|\]$/g, "");
  if (!isPublicRoutableHost(unwrappedHostname)) return false;
  if (isIP(unwrappedHostname) !== 0) return true;

  try {
    const addresses = (
      await Promise.all([
        resolveAddresses(resolve4, unwrappedHostname),
        resolveAddresses(resolve6, unwrappedHostname),
      ])
    ).flat();
    return (
      addresses.length > 0 &&
      addresses.every((address) => isPublicRoutableHost(address))
    );
  } catch {
    return false;
  }
}

/**
 * Cloudflare's `global_fetch_strictly_public` compatibility flag enforces the
 * resolve-once, public-address-only network boundary required by CIMD. Keeping
 * the transport in application code also prevents the auth package from
 * selecting a non-Worker fetch implementation. Workers do not implement
 * `redirect: "error"`, so use `manual`; CIMD still rejects every non-200
 * response before reading metadata.
 */
export const fetchCimdMetadataResource: ClientMetadataResourceFetch = (
  url,
  init,
) =>
  fetch(
    url,
    init?.redirect === "error" ? { ...init, redirect: "manual" } : init,
  );
