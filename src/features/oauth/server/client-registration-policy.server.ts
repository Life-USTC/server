import { prisma as defaultPrisma } from "@/lib/db/prisma";
import {
  OAUTH_AUTHORIZATION_CODE_GRANT_TYPE,
  OAUTH_DEVICE_CODE_GRANT_TYPE,
  OAUTH_PROVIDER_GRANT_TYPES,
  OAUTH_REFRESH_TOKEN_GRANT_TYPE,
} from "@/lib/oauth/constants";

export const DEVICE_REGISTRATION_DELEGATED_REDIRECT_URI =
  "http://127.0.0.1/oauth/device-registration-callback";

const OAUTH_PROVIDER_GRANT_TYPE_SET = new Set<string>(
  OAUTH_PROVIDER_GRANT_TYPES,
);
const DYNAMIC_CLIENT_REGISTRATION_GRANT_TYPE_SET = new Set<string>([
  ...OAUTH_PROVIDER_GRANT_TYPES,
  OAUTH_DEVICE_CODE_GRANT_TYPE,
]);

export type DeviceRegistrationMetadata = {
  grantTypes: string[];
  redirectUris?: string[];
};

type ClientRegistrationPolicyError = {
  error: "invalid_client_metadata";
  errorDescription: string;
};

type ClientRegistrationDelegation =
  | {
      delegatedBody: Record<string, unknown> | null;
      deviceRegistration: DeviceRegistrationMetadata | null;
    }
  | { error: ClientRegistrationPolicyError };

type ClientRegistrationPrisma = {
  oAuthClient: {
    update: (input: {
      where: { clientId: string };
      data: { grantTypes: string[]; redirectUris?: string[] };
    }) => Promise<unknown>;
  };
};

export function prepareOAuthClientRegistrationDelegation(
  body: unknown,
): ClientRegistrationDelegation {
  const bodyObject =
    body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  if (!bodyObject) {
    return { delegatedBody: null, deviceRegistration: null };
  }

  const grantTypes = Array.isArray(bodyObject.grant_types)
    ? bodyObject.grant_types
    : null;
  if (!grantTypes) {
    return { delegatedBody: null, deviceRegistration: null };
  }

  const unsupportedGrantType = grantTypes.find(
    (grantType) =>
      typeof grantType !== "string" ||
      !DYNAMIC_CLIENT_REGISTRATION_GRANT_TYPE_SET.has(grantType),
  );
  if (unsupportedGrantType !== undefined) {
    return {
      error: {
        error: "invalid_client_metadata",
        errorDescription: `Unsupported grant type: ${String(unsupportedGrantType)}`,
      },
    };
  }

  const requestedGrantTypes = grantTypes as string[];
  if (!requestedGrantTypes.includes(OAUTH_DEVICE_CODE_GRANT_TYPE)) {
    return { delegatedBody: null, deviceRegistration: null };
  }

  const providerGrantTypes = requestedGrantTypes.filter((grantType) =>
    OAUTH_PROVIDER_GRANT_TYPE_SET.has(grantType),
  );
  const delegatedGrantTypes =
    providerGrantTypes.length > 0
      ? providerGrantTypes
      : [OAUTH_REFRESH_TOKEN_GRANT_TYPE];
  const redirectUris = Array.isArray(bodyObject.redirect_uris)
    ? bodyObject.redirect_uris
    : null;
  const shouldInjectRedirectUri =
    !requestedGrantTypes.includes(OAUTH_AUTHORIZATION_CODE_GRANT_TYPE) &&
    (!redirectUris || redirectUris.length === 0);
  const delegatedRedirectUris = shouldInjectRedirectUri
    ? [DEVICE_REGISTRATION_DELEGATED_REDIRECT_URI]
    : redirectUris;

  return {
    delegatedBody: {
      ...bodyObject,
      grant_types: delegatedGrantTypes,
      ...(delegatedRedirectUris
        ? { redirect_uris: delegatedRedirectUris }
        : {}),
    },
    deviceRegistration: {
      grantTypes: requestedGrantTypes,
      ...(shouldInjectRedirectUri ? { redirectUris: [] } : {}),
    },
  };
}

export async function restoreRegisteredDeviceClientMetadata({
  body,
  prisma = defaultPrisma,
  registration,
}: {
  body: { client_id?: unknown };
  prisma?: ClientRegistrationPrisma;
  registration: DeviceRegistrationMetadata | null;
}) {
  if (!registration || typeof body.client_id !== "string") {
    return null;
  }

  await prisma.oAuthClient.update({
    where: { clientId: body.client_id },
    data: {
      grantTypes: registration.grantTypes,
      ...(registration.redirectUris !== undefined
        ? { redirectUris: registration.redirectUris }
        : {}),
    },
  });

  return {
    grant_types: registration.grantTypes,
    ...(registration.redirectUris !== undefined
      ? { redirect_uris: registration.redirectUris }
      : {}),
  };
}
