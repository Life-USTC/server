"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { auth, authApi } from "@/auth";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { logServerActionError } from "@/lib/log/app-logger";
import {
  resolveOAuthClientGrantTypes,
  resolveOAuthClientScopes,
} from "@/lib/oauth/client-registration";
import {
  isSupportedOAuthClientAuthMethod,
  OAUTH_CLIENT_SECRET_BASIC_AUTH_METHOD,
  OAUTH_CLIENT_SECRET_POST_AUTH_METHOD,
  OAUTH_CODE_RESPONSE_TYPE,
  OAUTH_PUBLIC_CLIENT_AUTH_METHOD,
  type SupportedOAuthClientAuthMethod,
} from "@/lib/oauth/constants";
import { asOAuthProviderApi } from "@/lib/oauth/provider-api";

type CreateOAuthClientResult =
  | { error: string }
  | { success: true; clientId: string; clientSecret: string | null };

const ADMIN_OAUTH_CLIENT_PATTERNS: Record<
  SupportedOAuthClientAuthMethod,
  {
    pattern: "public_pkce" | "confidential_connector" | "trusted_first_party";
    skipConsent: boolean;
    enableEndSession: boolean;
  }
> = {
  [OAUTH_PUBLIC_CLIENT_AUTH_METHOD]: {
    pattern: "public_pkce",
    skipConsent: false,
    enableEndSession: false,
  },
  [OAUTH_CLIENT_SECRET_POST_AUTH_METHOD]: {
    pattern: "confidential_connector",
    skipConsent: false,
    enableEndSession: false,
  },
  [OAUTH_CLIENT_SECRET_BASIC_AUTH_METHOD]: {
    pattern: "trusted_first_party",
    skipConsent: true,
    enableEndSession: true,
  },
} as const;

function resolveAdminOAuthClientPattern(tokenEndpointAuthMethod: string) {
  return isSupportedOAuthClientAuthMethod(tokenEndpointAuthMethod)
    ? ADMIN_OAUTH_CLIENT_PATTERNS[tokenEndpointAuthMethod]
    : null;
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function getOAuthActionErrorMessage(error: unknown, fallback: string) {
  const errorMessage =
    error instanceof Error ? nonEmptyString(error.message) : null;
  if (errorMessage) {
    return errorMessage;
  }

  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    const recordMessage = nonEmptyString(record.message);
    if (recordMessage) {
      return recordMessage;
    }

    const body = record.body;
    if (body && typeof body === "object") {
      const bodyRecord = body as Record<string, unknown>;
      const errorDescription = nonEmptyString(bodyRecord.error_description);
      if (errorDescription) {
        return errorDescription;
      }
      const bodyMessage = nonEmptyString(bodyRecord.message);
      if (bodyMessage) {
        return bodyMessage;
      }
    }
  }

  return fallback;
}

export async function createOAuthClient(
  formData: FormData,
): Promise<CreateOAuthClientResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Not authenticated" };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true },
  });

  if (!user?.isAdmin) {
    return { error: "Not authorized" };
  }

  const name = (formData.get("name") as string | null)?.trim();
  const redirectUrisRaw = (
    formData.get("redirectUris") as string | null
  )?.trim();
  const tokenEndpointAuthMethod =
    (formData.get("tokenEndpointAuthMethod") as string | null)?.trim() ||
    OAUTH_CLIENT_SECRET_BASIC_AUTH_METHOD;
  const requestedScopes = formData
    .getAll("scopes")
    .map((value) => String(value).trim())
    .filter(Boolean);

  if (!name) {
    return { error: "Name is required" };
  }
  if (!redirectUrisRaw) {
    return { error: "At least one redirect URI is required" };
  }

  const redirectUris = redirectUrisRaw
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  const scopesResult = resolveOAuthClientScopes(
    requestedScopes.length > 0 ? requestedScopes : undefined,
  );
  if ("error" in scopesResult) {
    return { error: scopesResult.error };
  }
  const scopes = scopesResult.scopes;
  const clientPattern = resolveAdminOAuthClientPattern(tokenEndpointAuthMethod);

  if (!clientPattern) {
    return { error: "Unsupported token endpoint auth method" };
  }

  try {
    const result = await asOAuthProviderApi(authApi).adminCreateOAuthClient({
      headers: await headers(),
      body: {
        client_name: name,
        redirect_uris: redirectUris,
        token_endpoint_auth_method: tokenEndpointAuthMethod,
        grant_types: resolveOAuthClientGrantTypes(scopes),
        response_types: [OAUTH_CODE_RESPONSE_TYPE],
        scope: scopes.join(" "),
        require_pkce: true,
        skip_consent: clientPattern.skipConsent,
        enable_end_session: clientPattern.enableEndSession,
        metadata: {
          source: "admin_panel",
          client_pattern: clientPattern.pattern,
        },
      },
    });

    revalidatePath("/admin/oauth");
    return {
      success: true,
      clientId: result.client_id,
      clientSecret: result.client_secret ?? null,
    };
  } catch (error) {
    logServerActionError("Failed to create OAuth client", error, {
      action: "createOAuthClient",
      userId: session.user.id,
    });
    return {
      error: getOAuthActionErrorMessage(error, "Failed to create OAuth client"),
    };
  }
}

export async function deleteOAuthClient(clientId: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Not authenticated" };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true },
  });

  if (!user?.isAdmin) {
    return { error: "Not authorized" };
  }

  const t = await getTranslations("oauth");

  try {
    // Admin must be able to remove clients without `userId` (e.g. anonymous DCR /
    // PKCE public clients). `authApi.deleteOAuthClient` only allows the owning
    // user or `referenceId` clients, so it returns UNAUTHORIZED for those rows.
    await prisma.oAuthClient.delete({
      where: { clientId },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return { error: t("deleteClientNotFound") };
    }
    logServerActionError("Failed to delete OAuth client", error, {
      action: "deleteOAuthClient",
      userId: session.user.id,
      clientId,
    });
    return { error: t("deleteClientFailed") };
  }

  revalidatePath("/admin/oauth");
  return { success: true };
}
