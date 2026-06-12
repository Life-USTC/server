import type { CommentStatus } from "@/generated/prisma/client";
import { withAdminApiRoute } from "@/lib/admin-api";
import { jsonResponse, notFound, parseRouteJsonBody } from "@/lib/api/helpers";
import { adminModerateCommentRequestSchema } from "@/lib/api/schemas/request-schemas";
import { fireAuditLog } from "@/lib/audit/write-audit-log";
import { type IdParams, parseIdParam } from "./admin-shared";

export async function patchAdminCommentRoute(
  request: Request,
  params: IdParams,
) {
  return withAdminApiRoute(
    request,
    "Failed to update comment",
    async (admin) => {
      const parsed = parseIdParam(params, "comment");
      if (parsed instanceof Response) return parsed;
      const id = parsed.id;
      const parsedBody = await parseRouteJsonBody(
        request,
        adminModerateCommentRequestSchema,
        "Invalid moderation request",
      );
      if (parsedBody instanceof Response) return parsedBody;

      const { prisma } = await import("@/lib/db/prisma");
      const existing = await prisma.comment.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!existing) return notFound();

      const { status, moderationNote } = parsedBody;
      const updated = await prisma.comment.update({
        where: { id },
        data: {
          status: status as CommentStatus,
          moderationNote: moderationNote ?? null,
          moderatedAt: new Date(),
          moderatedById: admin.userId,
          deletedAt: status === "deleted" ? new Date() : null,
        },
      });

      fireAuditLog({
        action: "admin_comment_moderate",
        userId: admin.userId,
        targetId: id,
        targetType: "comment",
        metadata: { status, moderationNote: moderationNote ?? null },
      });

      return jsonResponse({ comment: updated });
    },
  );
}
