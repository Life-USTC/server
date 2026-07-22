import { forbidden, notFound, unauthorized } from "@/lib/api/helpers";
import { parseBearerAuthorizationHeader } from "@/lib/auth/authorization-header";
import {
  type DemoApiScope,
  isDemoModeEnabled,
  verifyDemoApiToken,
} from "./demo-auth";

export async function requireDemoApiScope(
  request: Request,
  scope: DemoApiScope,
) {
  if (!isDemoModeEnabled()) return notFound();
  const bearer = parseBearerAuthorizationHeader(request.headers);
  const principal = bearer?.token
    ? await verifyDemoApiToken(bearer.token)
    : null;
  if (!principal) {
    return unauthorized();
  }
  if (!principal.scopes.has(scope)) {
    return forbidden();
  }
  return principal;
}
