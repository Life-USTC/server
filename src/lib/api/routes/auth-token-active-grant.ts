import {
  type ActiveOAuthRefreshGrant,
  isOAuthRefreshGrantActive,
  purgeOAuthGrantTokenRows,
  resolveActiveOAuthRefreshGrant,
} from "@/features/oauth/server/user-authorizations.server";
import { jsonResponse } from "@/lib/api/helpers";
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
      return {
        response: oauthGrantError(
          "invalid_grant",
          "The refresh token no longer has an active user grant.",
          400,
        ),
      };
    }
    return { grant };
  } catch {
    return {
      response: oauthGrantError(
        "server_error",
        "The authorization grant could not be verified.",
        503,
      ),
    };
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
  } catch {
    return oauthGrantError(
      "server_error",
      "The authorization grant could not be verified.",
      503,
    );
  }
}
