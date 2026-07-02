export function commentPanelSignInHref(pathname: string, search: string) {
  return `/signin?callbackUrl=${encodeURIComponent(`${pathname}${search}`)}`;
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

function pathSegment(value: PermalinkPathValue) {
  return encodeURIComponent(String(value));
}

function pathWithSearch(
  pathname: string,
  search: Record<string, PermalinkPathValue>,
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    params.set(key, String(value));
  }
  return `${pathname}?${params.toString()}`;
}

export function commentTargetPermalinkBaseHref(target: CommentPermalinkTarget) {
  if (target.type === "course") {
    return `/courses/${pathSegment(target.courseJwId)}/comments`;
  }
  if (target.type === "teacher") {
    return `/teachers/${pathSegment(target.teacherId)}/comments`;
  }
  if (target.type === "homework") {
    return pathWithSearch(
      `/sections/${pathSegment(target.sectionJwId)}/homework`,
      {
        homeworkId: target.homeworkId,
      },
    );
  }
  return `/sections/${pathSegment(target.sectionJwId)}/comments`;
}
