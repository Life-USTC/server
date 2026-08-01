import {
  courseDetailPagePath,
  teacherDetailPagePath,
} from "@/features/catalog/lib/catalog-detail-tab";
import {
  sectionDetailHomeworkPath,
  sectionDetailPagePath,
} from "@/features/section-detail/lib/section-detail-tab";

export function commentPanelSignInHref(pathname: string, search: string) {
  return `/account/sign-in?callbackUrl=${encodeURIComponent(`${pathname}${search}`)}`;
}

export function commentPanelStatusLabel(
  status: string,
  copy: {
    deletedBadge: string;
    softbannedBadge: string;
  },
) {
  if (status === "softbanned") return copy.softbannedBadge;
  if (status === "deleted") return copy.deletedBadge;
  return status;
}

export function commentPermalinkHref(currentHref: string, commentId: string) {
  const isAbsolute = /^[a-z][a-z\d+\-.]*:/i.test(currentHref);
  const url = new URL(currentHref, "https://life-ustc.local");
  url.hash = `comment-${commentId}`;
  if (isAbsolute) return url.toString();
  return `${url.pathname}${url.search}${url.hash}`;
}

export function absoluteCommentPermalinkHref({
  commentId,
  currentHref,
  permalinkBaseHref,
}: {
  commentId: string;
  currentHref: string;
  permalinkBaseHref: string;
}) {
  return commentPermalinkHref(
    new URL(permalinkBaseHref, currentHref).toString(),
    commentId,
  );
}

type PermalinkPathValue = number | string;

export type CommentPermalinkTarget =
  | {
      sectionJwId: PermalinkPathValue;
      type: "section" | "section-teacher";
    }
  | {
      courseJwId: PermalinkPathValue;
      type: "course";
    }
  | {
      teacherId: PermalinkPathValue;
      type: "teacher";
    }
  | {
      homeworkId: PermalinkPathValue;
      sectionJwId: PermalinkPathValue;
      type: "homework";
    };

export function commentTargetPermalinkBaseHref(target: CommentPermalinkTarget) {
  if (target.type === "course") {
    return courseDetailPagePath(target.courseJwId, "comments");
  }
  if (target.type === "teacher") {
    return teacherDetailPagePath(target.teacherId, "comments");
  }
  if (target.type === "homework") {
    return sectionDetailHomeworkPath(target.sectionJwId, {
      homeworkId: target.homeworkId,
    });
  }
  return sectionDetailPagePath(target.sectionJwId, "comments");
}
