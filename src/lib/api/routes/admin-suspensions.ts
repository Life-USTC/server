import { withAdminApiRoute } from "@/lib/admin-api";
import { parseRouteJsonBody } from "@/lib/api/helpers";
import { adminCreateSuspensionRequestSchema } from "@/lib/api/schemas/request-schemas";
import { type IdParams, parseIdParam } from "./admin-shared";
import {
  createAdminSuspensionAction,
  liftAdminSuspensionAction,
  listAdminSuspensionsAction,
} from "./admin-suspension-actions";

export async function getAdminSuspensionsRoute(request: Request) {
  return withAdminApiRoute(request, "Failed to fetch suspensions", async () => {
    return listAdminSuspensionsAction();
  });
}

export async function postAdminSuspensionRoute(request: Request) {
  return withAdminApiRoute(request, "Failed to suspend user", async (admin) => {
    const parsedBody = await parseRouteJsonBody(
      request,
      adminCreateSuspensionRequestSchema,
      "Invalid suspension request",
    );
    if (parsedBody instanceof Response) return parsedBody;

    return createAdminSuspensionAction(admin.userId, parsedBody);
  });
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

      return liftAdminSuspensionAction(admin.userId, id);
    },
  );
}
