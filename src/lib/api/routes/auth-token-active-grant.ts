import {
  type ActiveOAuthRefreshGrant,
  isOAuthRefreshGrantActive,
  purgeOAuthGrantTokenRows,
  purgeRevokedOAuthRefreshTokenLineage,
  resolveActiveOAuthRefreshGrant,
} from "@/features/oauth/server/user-authorizations.server";
import { jsonResponse } from "@/lib/api/helpers";
import { logAppEvent } from "@/lib/log/app-logger";
import { getSafeErrorName } from "@/lib/log/safe-error-name";
import { writeOAuthEventAnalytics } from "@/lib/metrics/analytics-engine";
import { OAUTH_REFRESH_TOKEN_GRANT_TYPE } from "@/lib/oauth/constants";

type RefreshGrantValidation =
  | { grant: ActiveOAuthRefreshGrant | null }
  | { response: Response };

function oauthGrantError(
  error: "invalid_grant" | "server_error",
  error_description: string,
  status: number,
) {
  return jsonResponse({ error, error_description }, { status });
}

function logOAuthGrantValidationError(phase: string, error: unknown) {
  const errorName = getSafeErrorName(error);
  logAppEvent("error", "oauth.token.grant-validation-failed", {
    errorName,
    phase,
  });
  writeOAuthEventAnalytics({
    errorName,
    event: "grant-validation-failed",
    ioObservedDurationMs: 0,
    path: "/api/auth/oauth2/token",
    phase,
    status: 503,
  });
}

export async function validateActiveOAuthRefreshGrant(
  params: URLSearchParams,
): Promise<RefreshGrantValidation> {
  if (params.get("grant_type") !== OAUTH_REFRESH_TOKEN_GRANT_TYPE) {
    return { grant: null };
  }

  try {
    const grant = await resolveActiveOAuthRefreshGrant(
      params.get("refresh_token"),
    );
    if (!grant) {
      await purgeRevokedOAuthRefreshTokenLineage(params.get("refresh_token"));
      return {
        response: oauthGrantError(
          "invalid_grant",
          "The refresh token no longer has an active user grant.",
          400,
        ),
      };
    }
    return { grant };
  } catch (error) {
    logOAuthGrantValidationError("resolve-active-refresh-grant", error);
    return {
      response: oauthGrantError(
        "server_error",
        "The authorization grant could not be verified.",
        503,
      ),
    };
  }
}

export async function cleanupRejectedOAuthRefreshGrant(
  params: URLSearchParams,
): Promise<Response | undefined> {
  if (params.get("grant_type") !== OAUTH_REFRESH_TOKEN_GRANT_TYPE) {
    return undefined;
  }

  try {
    await purgeRevokedOAuthRefreshTokenLineage(params.get("refresh_token"));
    return undefined;
  } catch (error) {
    logOAuthGrantValidationError("cleanup-rejected-refresh-grant", error);
    return oauthGrantError(
      "server_error",
      "The authorization grant could not be verified.",
      503,
    );
  }
}

export async function rejectRefreshIssuedAfterRevocation(
  grant: ActiveOAuthRefreshGrant | null,
): Promise<Response | undefined> {
  if (!grant) return undefined;

  try {
    if (await isOAuthRefreshGrantActive(grant)) return undefined;
    await purgeOAuthGrantTokenRows(grant);
    return oauthGrantError(
      "invalid_grant",
      "The authorization grant was revoked during refresh.",
      400,
    );
  } catch (error) {
    logOAuthGrantValidationError("recheck-active-refresh-grant", error);
    return oauthGrantError(
      "server_error",
      "The authorization grant could not be verified.",
      503,
    );
  }
}
