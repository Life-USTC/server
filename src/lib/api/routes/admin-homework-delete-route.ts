import { deleteHomework } from "@/features/homeworks/server/homework-mutations";
import { jsonResponse, notFound } from "@/lib/api/helpers";
import { withAdminApiRoute } from "@/lib/api/routes/admin-route-auth";
import { type IdParams, parseIdParam } from "./admin-shared";

export async function deleteAdminHomeworkRoute(
  request: Request,
  params: IdParams,
) {
  return withAdminApiRoute(
    request,
    "Failed to delete homework (admin)",
    async (admin) => {
      const parsed = parseIdParam(params, "homework");
      if (parsed instanceof Response) return parsed;
      const id = parsed.id;

      const result = await deleteHomework({
        allowAnyOwner: true,
        homeworkId: id,
        userId: admin.userId,
      });
      if (!result.ok) return notFound();

      return jsonResponse({ success: true });
    },
  );
}
