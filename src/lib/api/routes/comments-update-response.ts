import type {
  RawComment,
  ViewerInfo,
} from "@/features/comments/server/comment-serialization";
import {
  fireAuditLog,
  getAuditRequestMetadata,
} from "@/lib/audit/write-audit-log";

export async function loadUpdatedCommentResponse(
  prisma: {
    comment: {
      findUnique: (input: {
        where: { id: string };
        include: {
          user: {
            select: {
              id: true;
              name: true;
              image: true;
              isAdmin: true;
              accounts: { select: { provider: true } };
            };
          };
          attachments: {
            include: {
              upload: {
                select: {
                  filename: true;
                  contentType: true;
                  size: true;
                };
              };
            };
          };
          reactions: { select: { type: true; userId: true } };
        };
      }) => Promise<RawComment | null>;
    };
  },
  id: string,
  viewer: ViewerInfo,
) {
  const { buildCommentNodes } = await import(
    "@/features/comments/server/comment-serialization"
  );
  const updatedComment = await prisma.comment.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          image: true,
          isAdmin: true,
          accounts: {
            select: { provider: true },
          },
        },
      },
      attachments: {
        include: {
          upload: {
            select: {
              filename: true,
              contentType: true,
              size: true,
            },
          },
        },
      },
      reactions: {
        select: {
          type: true,
          userId: true,
        },
      },
    },
  });

  if (!updatedComment) return null;
  const { roots } = buildCommentNodes([updatedComment], viewer);
  return roots[0];
}

export function writeCommentEditAuditLog({
  body,
  commentId,
  request,
  userId,
}: {
  body?: string;
  commentId: string;
  request: Request;
  userId: string;
}) {
  fireAuditLog({
    action: "comment_edit",
    userId,
    targetId: commentId,
    targetType: "comment",
    metadata: { body: body?.slice(0, 200) },
    ...getAuditRequestMetadata(request),
  });
}
