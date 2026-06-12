import { jsonResponse } from "@/lib/api/helpers";
import { DEVICE_ACCESS_TOKEN_EXPIRES_IN } from "@/lib/api/routes/auth-token-device-token-issuer";

export function deviceGrantTokenResponse({
  issued,
  scopes,
}: {
  issued: { accessToken: string; refreshToken: string };
  scopes: string[];
}) {
  return jsonResponse({
    access_token: issued.accessToken,
    token_type: "Bearer",
    expires_in: DEVICE_ACCESS_TOKEN_EXPIRES_IN,
    refresh_token: issued.refreshToken,
    scope: scopes.join(" "),
  });
}
