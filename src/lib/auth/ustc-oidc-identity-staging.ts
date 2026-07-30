import type { UstcOidcIdentityClaims } from "@/features/settings/lib/ustc-identity";

const pendingUstcOidcIdentityClaims = new Map<string, UstcOidcIdentityClaims>();

export function stageUstcOidcIdentityClaims(claims: UstcOidcIdentityClaims) {
  pendingUstcOidcIdentityClaims.set(claims.upstreamUid, claims);
}

export function consumeStagedUstcOidcIdentityClaims(
  upstreamUid: string,
): UstcOidcIdentityClaims | null {
  const claims = pendingUstcOidcIdentityClaims.get(upstreamUid) ?? null;
  pendingUstcOidcIdentityClaims.delete(upstreamUid);
  return claims;
}

export function clearStagedUstcOidcIdentityClaims() {
  pendingUstcOidcIdentityClaims.clear();
}
