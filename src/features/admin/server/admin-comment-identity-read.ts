import { error } from "@sveltejs/kit";
import type { Prisma } from "@/generated/prisma/client";
import { writeAuditLogs } from "@/lib/audit/write-audit-log";

export async function requireCommentIdentityModerator(
  client: Prisma.TransactionClient,
  adminUserId: string,
) {
  const [user, suspension] = await Promise.all([
    client.user.findUnique({
      where: { id: adminUserId },
      select: { isAdmin: true },
    }),
    client.userSuspension.findFirst({
      where: {
        userId: adminUserId,
        liftedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: { id: true },
    }),
  ]);
  if (!user?.isAdmin || suspension) error(403, "Forbidden");
}

export async function auditCommentIdentityRead({
  adminUserId,
  channel,
  client,
  comments,
}: {
  adminUserId: string;
  channel: "web" | "rest";
  client: Prisma.TransactionClient;
  comments: { id: string; isAnonymous: boolean }[];
}) {
  // The transaction must commit this record before any identity leaves the service.
  // Record the inspected comment, never its anonymous author's identity fields.
  await writeAuditLogs(
    comments
      .filter((comment) => comment.isAnonymous)
      .map((comment) => ({
        action: "admin_comment_identity_reveal",
        channel,
        userId: adminUserId,
        targetType: "comment",
        targetId: comment.id,
      })),
    client,
  );
}
