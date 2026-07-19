import { GraphQLError } from "graphql";
import { isTrustedAuthOrigin } from "@/lib/auth/auth-origins";
import { parseBearerAuthorizationHeader } from "@/lib/auth/authorization-header";
import { verifyAccessTokenJwt } from "@/lib/auth/jwt-verification";
import { hasRequestAuthSignal } from "@/lib/auth/request-auth-signal";
import { hasActiveOAuthUserGrant } from "@/lib/oauth/active-user-grant";
import { getJwksUrlForOAuthVerification } from "@/lib/oauth/metadata-urls";
import {
  getOAuthGraphqlAudienceUrls,
  getOAuthGraphqlResourceUrl,
  getOAuthTokenVerificationIssuers,
} from "@/lib/oauth/resource-urls";
import {
  type FeatureScopeRequirement,
  getRequiredFeatureScope,
  hasRequiredFeatureScope,
} from "@/lib/oauth/scope-registry";
import { resourceIndicatorsMatch } from "@/lib/oauth/utils";

export type GraphqlPrincipal =
  | { kind: "anonymous" }
  | { kind: "session"; userId: string }
  | {
      kind: "oauth";
      userId: string;
      scopes: Set<string>;
      resource: string;
      clientId?: string;
    };

export type AuthenticatedGraphqlPrincipal = Exclude<
  GraphqlPrincipal,
  { kind: "anonymous" }
>;

export type GraphqlScopeRequirement = FeatureScopeRequirement;

export type GraphqlAuthErrorCode = "FORBIDDEN" | "UNAUTHENTICATED";

export class GraphqlAuthError extends GraphQLError {
  constructor(
    message: string,
    readonly code: GraphqlAuthErrorCode,
    readonly status: 401 | 403,
    readonly requiredScopes: string[] = [],
  ) {
    super(message, {
      extensions: {
        code,
        requiredScopes,
        http: { status },
      },
    });
  }
}

async function getLocalJwks() {
  const { authApi } = await import("@/lib/auth/core");
  return authApi.getJwks({});
}

function getAudienceValues(audience: string | string[]) {
  return Array.isArray(audience) ? audience : [audience];
}

function hasGraphqlAudience(audience: string | string[]) {
  const accepted = getOAuthGraphqlAudienceUrls();
  return getAudienceValues(audience).some((value) =>
    accepted.some((candidate) => resourceIndicatorsMatch(value, candidate)),
  );
}

function unauthenticated(message = "Authentication required") {
  return new GraphqlAuthError(message, "UNAUTHENTICATED", 401);
}

function forbidden(message: string, requiredScopes: string[] = []) {
  return new GraphqlAuthError(message, "FORBIDDEN", 403, requiredScopes);
}

async function resolveBearerPrincipal(
  token: string | null,
): Promise<AuthenticatedGraphqlPrincipal> {
  if (!token) throw unauthenticated("Invalid bearer token");

  try {
    const verified = await verifyAccessTokenJwt(token, {
      jwksFetch: getLocalJwks,
      jwksUrl: getJwksUrlForOAuthVerification(),
      issuer: getOAuthTokenVerificationIssuers(),
      audience: getOAuthGraphqlAudienceUrls(),
    });
    if (!hasGraphqlAudience(verified.aud)) {
      throw unauthenticated("Invalid bearer token audience");
    }
    if (
      !verified.clientId ||
      !(await hasActiveOAuthUserGrant({
        clientId: verified.clientId,
        grantId: verified.grantId,
        requireGrantBinding: true,
        scopes: verified.tokenScopes ?? [...verified.scope],
        userId: verified.sub,
      }))
    ) {
      throw unauthenticated("OAuth authorization grant is inactive");
    }

    return {
      kind: "oauth",
      userId: verified.sub,
      scopes: verified.scope,
      resource: getOAuthGraphqlResourceUrl(),
      ...(verified.clientId ? { clientId: verified.clientId } : {}),
    };
  } catch (error) {
    if (error instanceof GraphqlAuthError) throw error;
    throw unauthenticated("Invalid bearer token");
  }
}

async function resolveSessionPrincipal(
  request: Request,
): Promise<GraphqlPrincipal> {
  const origin = request.headers.get("origin");
  if (!origin || !isTrustedAuthOrigin(origin)) {
    throw forbidden("Invalid session request origin");
  }

  const { getSessionFromHeaders } = await import("@/lib/auth/core");
  const session = await getSessionFromHeaders(request.headers);
  return session
    ? { kind: "session", userId: session.user.id }
    : { kind: "anonymous" };
}

export async function resolveGraphqlPrincipal(
  request: Request,
): Promise<GraphqlPrincipal> {
  const bearer = parseBearerAuthorizationHeader(request.headers);
  if (bearer) {
    return resolveBearerPrincipal(bearer.token);
  }
  if (!hasRequestAuthSignal(request.headers)) {
    return { kind: "anonymous" };
  }
  return resolveSessionPrincipal(request);
}

export function requireGraphqlScopes(
  principal: GraphqlPrincipal,
  requirements: readonly GraphqlScopeRequirement[],
): AuthenticatedGraphqlPrincipal {
  if (principal.kind === "anonymous") throw unauthenticated();
  if (principal.kind === "session") return principal;

  const missingScopes = requirements
    .filter(
      (requirement) => !hasRequiredFeatureScope(principal.scopes, requirement),
    )
    .map(getRequiredFeatureScope);
  if (missingScopes.length > 0) {
    throw forbidden("Insufficient OAuth scope", missingScopes);
  }
  return principal;
}

export function requireGraphqlScope(
  principal: GraphqlPrincipal,
  requirement: GraphqlScopeRequirement,
) {
  return requireGraphqlScopes(principal, [requirement]);
}
