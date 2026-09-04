import {
  type DeviceRegistrationMetadata,
  prepareOAuthClientRegistrationDelegation,
  restoreRegisteredDeviceClientMetadata,
} from "@/features/oauth/server/client-registration-policy.server";

function isOAuthClientRegistrationRequest(request: Request) {
  return new URL(request.url).pathname.endsWith("/oauth2/register");
}

type OAuthClientRegistrationPreparation =
  | { request: Request; deviceRegistration: DeviceRegistrationMetadata | null }
  | { response: Response };

export async function prepareOAuthClientRegistrationRequest(
  request: Request,
): Promise<OAuthClientRegistrationPreparation> {
  if (!isOAuthClientRegistrationRequest(request)) {
    return { request, deviceRegistration: null };
  }

  let body: unknown;
  try {
    body = await request.clone().json();
  } catch {
    return {
      response: Response.json(
        {
          error: "invalid_client_metadata",
          error_description: "Invalid JSON request body",
        },
        { status: 400 },
      ),
    };
  }

  const bodyObject =
    body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  if (!bodyObject) {
    return { request, deviceRegistration: null };
  }

  const prepared = prepareOAuthClientRegistrationDelegation(bodyObject);
  if ("error" in prepared) {
    return {
      response: Response.json(
        {
          error: prepared.error.error,
          error_description: prepared.error.errorDescription,
        },
        { status: 400 },
      ),
    };
  }

  if (!prepared.delegatedBody) {
    return { request, deviceRegistration: null };
  }

  const headers = new Headers(request.headers);
  headers.set("content-type", "application/json");

  return {
    request: new Request(request, {
      body: JSON.stringify(prepared.delegatedBody),
      headers,
    }),
    deviceRegistration: prepared.deviceRegistration,
  };
}

export async function restoreDeviceRegistrationGrantTypes(
  response: Response,
  registration: DeviceRegistrationMetadata | null,
) {
  if (!registration || !response.ok) {
    return response;
  }

  const body = (await response
    .clone()
    .json()
    .catch(() => null)) as {
    client_id?: unknown;
    grant_types?: unknown;
  } | null;
  if (!body || typeof body.client_id !== "string") {
    return response;
  }

  const restored = await restoreRegisteredDeviceClientMetadata({
    body,
    registration,
  });
  if (!restored) return response;

  const headers = new Headers(response.headers);
  headers.delete("content-length");
  return Response.json(
    {
      ...body,
      ...restored,
    },
    {
      status: response.status,
      headers,
    },
  );
}
