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
  const url = new URL(currentHref);
  if (
    url.pathname.startsWith("/courses/") ||
    url.pathname.startsWith("/sections/") ||
    url.pathname.startsWith("/teachers/")
  ) {
    url.searchParams.set("tab", "comments");
  }
  url.hash = `comment-${commentId}`;
  return url.toString();
}
