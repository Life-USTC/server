import { parseBearerAuthorizationHeader } from "@/lib/auth/authorization-header";
import { type DemoApiScope, verifyDemoApiToken } from "./demo-auth";

export async function requireDemoApiScope(
  request: Request,
  scope: DemoApiScope,
) {
  const bearer = parseBearerAuthorizationHeader(request.headers);
  const principal = bearer?.token
    ? await verifyDemoApiToken(bearer.token)
    : null;
  if (!principal) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!principal.scopes.has(scope)) {
    return new Response("Forbidden", { status: 403 });
  }
  return principal;
}
