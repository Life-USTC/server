import {
  commentPermalinkHref,
  commentTargetPermalinkBaseHref,
} from "@/features/comments/lib/comment-panel-links";
import {
  COMMENT_REPLY_PREVIEW_SIZE,
  decodeCommentReplyCursor,
  encodeCommentReplyCursor,
} from "@/features/comments/server/comment-reply-pagination";
import {
  buildCommentNodes,
  type RawComment,
} from "@/features/comments/server/comment-serialization";
import type { AppLocale } from "@/i18n/config";
import { buildPaginatedResponse } from "@/lib/pagination";
import { getDemoCatalogViewer } from "./demo-catalog";
import { resolveDemoCatalogTarget } from "./demo-catalog-community";
import {
  type DemoCommunityRecord,
  getDemoCommunityRecords,
} from "./demo-community-fixture";

type Target = NonNullable<ReturnType<typeof resolveDemoCatalogTarget>>;
const order = (a: RawComment, b: RawComment) =>
  a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id);
const targetKey = (target: Target) =>
  target.type === "section-teacher"
    ? `section-teacher:${target.sectionId}:${target.teacherId}`
    : `${target.type}:${target.homeworkId ?? target.targetId}`;

function targetFor(record: DemoCommunityRecord, locale: AppLocale): Target {
  const target = resolveDemoCatalogTarget(record.target, locale);
  if (!target) throw new Error("Invalid fixed demo discussion target");
  return target;
}

function descendants(records: DemoCommunityRecord[], rootId: string) {
  return records
    .map(({ comment }) => comment)
    .filter((comment) => comment.rootId === rootId)
    .sort(order);
}

function windowNodes(
  root: RawComment,
  allReplies: RawComment[],
  selected: RawComment[],
  hasMore: boolean,
) {
  const included = new Map(selected.map((comment) => [comment.id, comment]));
  // A later reply may refer to an earlier visible parent outside this page.
  for (const reply of selected) {
    let parent = reply.parentId;
    while (parent && parent !== root.id && !included.has(parent)) {
      const ancestor = allReplies.find(({ id }) => id === parent);
      if (!ancestor) throw new Error("Disconnected fixed demo discussion");
      included.set(ancestor.id, ancestor);
      parent = ancestor.parentId;
    }
  }
  const last = selected.at(-1);
  const nextCursor =
    hasMore && last
      ? encodeCommentReplyCursor({
          rootId: root.id,
          id: last.id,
          createdAt: last.createdAt.toISOString(),
        })
      : null;
  const { roots } = buildCommentNodes(
    [root, ...included.values()],
    getDemoCatalogViewer(),
    {
      repliesNextCursorByRootId: new Map([[root.id, nextCursor]]),
    },
  );
  return { thread: roots, nextCursor };
}

export function getDemoCommunityPage(
  target: Target,
  locale: AppLocale,
  page: number,
  pageSize: number,
) {
  const records = getDemoCommunityRecords(locale);
  const roots = records
    .filter(
      (record) =>
        !record.comment.parentId &&
        targetKey(targetFor(record, locale)) === targetKey(target),
    )
    .map(({ comment }) => comment)
    .sort(order);
  const comments = roots
    .slice((page - 1) * pageSize, page * pageSize)
    .flatMap((root) => {
      const replies = descendants(records, root.id);
      return windowNodes(
        root,
        replies,
        replies.slice(0, COMMENT_REPLY_PREVIEW_SIZE),
        replies.length > COMMENT_REPLY_PREVIEW_SIZE,
      ).thread;
    });
  return {
    ...buildPaginatedResponse(comments, page, pageSize, roots.length),
    meta: { hiddenCount: 0, viewer: getDemoCatalogViewer(), target },
  };
}

export function getDemoCommunityComment(id: string, locale: AppLocale) {
  const records = getDemoCommunityRecords(locale);
  const record = records.find(({ comment }) => comment.id === id);
  if (!record) return null;
  const root = records.find(
    ({ comment }) => comment.id === (record.comment.rootId ?? id),
  )?.comment;
  if (!root) throw new Error("Missing fixed demo discussion root");
  const replies = descendants(records, root.id);
  const selected = replies.slice(0, COMMENT_REPLY_PREVIEW_SIZE);
  if (record.comment.parentId && !selected.some((comment) => comment.id === id))
    selected.push(record.comment);
  const { thread } = windowNodes(
    root,
    replies,
    selected,
    replies.length > selected.length,
  );
  return {
    thread,
    focusId: id,
    hiddenCount: 0,
    viewer: getDemoCatalogViewer(),
    target: targetFor(record, locale),
  };
}

export function getDemoCommunityReplies(
  id: string,
  locale: AppLocale,
  cursor: string | undefined,
  pageSize: number,
) {
  const records = getDemoCommunityRecords(locale);
  const anchor = records.find(({ comment }) => comment.id === id)?.comment;
  const root =
    anchor &&
    records.find(({ comment }) => comment.id === (anchor.rootId ?? anchor.id))
      ?.comment;
  if (!root) return { ok: false, error: "not_found" } as const;
  const after = cursor ? decodeCommentReplyCursor(cursor) : null;
  if (cursor && (!after || after.rootId !== root.id))
    return { ok: false, error: "invalid_cursor" } as const;
  const replies = descendants(records, root.id);
  if (
    after &&
    !replies.some(
      (reply) =>
        reply.id === after.id &&
        reply.createdAt.toISOString() === after.createdAt,
    )
  )
    return { ok: false, error: "invalid_cursor" } as const;
  const remaining = after
    ? replies.filter(
        (reply) =>
          reply.createdAt.toISOString() > after.createdAt ||
          (reply.createdAt.toISOString() === after.createdAt &&
            reply.id > after.id),
      )
    : replies;
  const result = windowNodes(
    root,
    replies,
    remaining.slice(0, pageSize),
    remaining.length > pageSize,
  );
  return {
    ok: true,
    rootId: root.id,
    ...result,
    viewer: getDemoCatalogViewer(),
  } as const;
}

export function getDemoCommunityPermalink(id: string, locale: AppLocale) {
  const record = getDemoCommunityRecords(locale).find(
    ({ comment }) => comment.id === id,
  );
  if (!record) return null;
  const target = targetFor(record, locale);
  let base: string;
  if (target.type === "course" && target.courseJwId)
    base = commentTargetPermalinkBaseHref({
      type: "course",
      courseJwId: target.courseJwId,
    });
  else if (target.type === "teacher" && target.targetId)
    base = commentTargetPermalinkBaseHref({
      type: "teacher",
      teacherId: target.targetId,
    });
  else if (
    target.type === "homework" &&
    target.homeworkId &&
    target.homeworkSectionJwId
  )
    base = commentTargetPermalinkBaseHref({
      type: "homework",
      homeworkId: target.homeworkId,
      sectionJwId: target.homeworkSectionJwId,
    });
  else if (target.sectionJwId)
    base = commentTargetPermalinkBaseHref({
      type: "section",
      sectionJwId: target.sectionJwId,
    });
  else throw new Error("Missing fixed demo discussion URL");
  return commentPermalinkHref(base, id);
}
