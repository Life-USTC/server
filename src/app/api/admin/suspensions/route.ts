import { withAdminRoute } from "@/lib/admin-utils";
import { jsonResponse, notFound, parseRouteJsonBody } from "@/lib/api/helpers";
import { adminCreateSuspensionRequestSchema } from "@/lib/api/schemas/request-schemas";
import { fireAuditLog } from "@/lib/audit/write-audit-log";
import { prisma } from "@/lib/db/prisma";
import { observedApiRoute } from "@/lib/log/api-observability";
import { parseDateInput } from "@/lib/time/parse-date-input";

export const dynamic = "force-dynamic";

function parseDate(value: string | null) {
  const parsed = parseDateInput(value);
  return parsed instanceof Date ? parsed : null;
}

/**
 * List suspensions.
 * @response adminSuspensionsResponseSchema
 */
async function getRoute() {
  return withAdminRoute("Failed to fetch suspensions", async () => {
    const suspensions = await prisma.userSuspension.findMany({
      include: {
        user: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return jsonResponse({ suspensions });
  });
}
export const GET = observedApiRoute(getRoute);

/**
 * Create suspension for one user.
 * @body adminCreateSuspensionRequestSchema
 * @response adminSuspensionResponseSchema
 * @response 400:openApiErrorSchema
 */
async function postRoute(request: Request) {
  return withAdminRoute("Failed to suspend user", async (admin) => {
    const parsedBody = await parseRouteJsonBody(
      request,
      adminCreateSuspensionRequestSchema,
      "Invalid suspension request",
    );
    if (parsedBody instanceof Response) {
      return parsedBody;
    }

    const userId = parsedBody.userId.trim();
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      return notFound("User not found");
    }

    const suspension = await prisma.userSuspension.create({
      data: {
        userId,
        createdById: admin.userId,
        reason: parsedBody.reason?.trim() || null,
        note: parsedBody.note?.trim() || null,
        expiresAt: parseDate(parsedBody.expiresAt ?? null),
      },
    });

    fireAuditLog({
      action: "admin_user_suspend",
      userId: admin.userId,
      targetId: userId,
      targetType: "user",
      metadata: { reason: parsedBody.reason ?? null },
    });

    return jsonResponse({ suspension });
  });
}
export const POST = observedApiRoute(postRoute);
