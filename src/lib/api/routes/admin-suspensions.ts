import {
  createAdminSuspension,
  liftAdminSuspension,
  listAdminSuspensions,
} from "@/features/admin/server/admin-api-service";
import {
  badRequest,
  createdJsonResponse,
  jsonResponse,
  notFound,
  parseRouteJsonBody,
} from "@/lib/api/helpers";
import { withAdminApiRoute } from "@/lib/api/routes/admin-route-auth";
import { adminCreateSuspensionRequestSchema } from "@/lib/api/schemas/request-schemas";
import { type IdParams, parseIdParam } from "./admin-shared";

export async function getAdminSuspensionsRoute(request: Request) {
  return withAdminApiRoute(request, "Failed to fetch suspensions", async () => {
    const suspensions = await listAdminSuspensions();
    return jsonResponse({ suspensions });
  });
}

export async function postAdminSuspensionRoute(request: Request) {
  return withAdminApiRoute(
    request,
    "Failed to suspend user",
    async (admin) => {
      const parsedBody = await parseRouteJsonBody(
        request,
        adminCreateSuspensionRequestSchema,
        "Invalid suspension request",
      );
      if (parsedBody instanceof Response) return parsedBody;

      const result = await createAdminSuspension(admin.userId, parsedBody);
      if (!result.ok) {
        if (result.reason === "invalid_expires_at") {
          return badRequest("Invalid expiresAt");
        }
        if (result.reason === "cannot_suspend_self") {
          return badRequest("Admins cannot suspend themselves");
        }
        return notFound("User not found");
      }

      return createdJsonResponse(
        { suspension: result.suspension },
        `/api/admin/suspensions/${encodeURIComponent(result.suspension.id)}`,
      );
    },
    { requireActive: true },
  );
}

export async function patchAdminSuspensionRoute(
  request: Request,
  params: IdParams,
) {
  return withAdminApiRoute(
    request,
    "Failed to lift suspension",
    async (admin) => {
      const parsed = parseIdParam(params, "suspension");
      if (parsed instanceof Response) return parsed;
      const id = parsed.id;

      const result = await liftAdminSuspension(admin.userId, id);
      if (!result.ok) return notFound();

      return jsonResponse({ suspension: result.suspension });
    },
    { requireActive: true },
  );
}
