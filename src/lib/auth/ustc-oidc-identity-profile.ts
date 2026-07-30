import {
  extractUstcOidcIdentityClaims,
  type UstcOidcIdentityClaims,
} from "@/features/settings/lib/ustc-identity";
import { getOidcAccountSubject } from "@/lib/auth/oauth-profile-mappers";
import type { OAuthProfile } from "@/lib/auth/oauth-profile-types";
import { stageUstcOidcIdentityClaims } from "@/lib/auth/ustc-oidc-identity-staging";

export function buildUstcOidcIdentityClaimsFromProfile(
  profile: OAuthProfile,
): UstcOidcIdentityClaims {
  const upstreamUid = getOidcAccountSubject(profile);
  return extractUstcOidcIdentityClaims(profile, upstreamUid);
}

export function stageUstcOidcIdentityFromProfile(profile: OAuthProfile) {
  stageUstcOidcIdentityClaims(buildUstcOidcIdentityClaimsFromProfile(profile));
}
