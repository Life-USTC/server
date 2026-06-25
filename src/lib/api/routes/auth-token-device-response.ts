import { jsonResponse } from "@/lib/api/helpers";

export function deviceGrantTokenResponse({
  issued,
  scopes,
}: {
  issued: { accessToken: string; expiresIn: number; refreshToken?: string };
  scopes: string[];
}) {
  return jsonResponse({
    access_token: issued.accessToken,
    token_type: "Bearer",
    expires_in: issued.expiresIn,
    ...(issued.refreshToken ? { refresh_token: issued.refreshToken } : {}),
    scope: scopes.join(" "),
  });
}
