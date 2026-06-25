import {
  OAUTH_DEVICE_CODE_GRANT_TYPE,
  OAUTH_PUBLIC_CLIENT_AUTH_METHOD,
} from "@/lib/oauth/constants";

type DeviceAuthorizationClient = {
  grantTypes: string[];
  public: boolean | null;
  tokenEndpointAuthMethod: string | null;
  type: string | null;
};

export function getDeviceAuthorizationClientPolicyFailure(
  client: DeviceAuthorizationClient,
): "unsupported_grant" | "confidential_client" | null {
  if (!client.grantTypes.includes(OAUTH_DEVICE_CODE_GRANT_TYPE)) {
    return "unsupported_grant";
  }

  if (
    client.tokenEndpointAuthMethod === OAUTH_PUBLIC_CLIENT_AUTH_METHOD ||
    client.public === true ||
    client.type === "native" ||
    client.type === "public" ||
    client.type === "user-agent-based"
  ) {
    return null;
  }

  return "confidential_client";
}
