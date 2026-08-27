const COMMENT_REPLY_CURSOR_VERSION = 1;

export type CommentReplyCursor = {
  createdAt: string;
  id: string;
  rootId: string;
};

/** Maximum number of replies included for each root in an initial list page. */
export const COMMENT_REPLY_PREVIEW_SIZE = 10;

/** Maximum number of replies returned by one continuation request. */
export const COMMENT_REPLY_PAGE_SIZE = 20;

/** Keep enough parents to render a bounded reply page without losing ancestry. */
export const COMMENT_REPLY_MAX_ANCESTRY_DEPTH = 20;

export function encodeCommentReplyCursor(cursor: CommentReplyCursor) {
  const payload = JSON.stringify({
    ...cursor,
    version: COMMENT_REPLY_CURSOR_VERSION,
  });
  return btoa(payload)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

export function decodeCommentReplyCursor(
  value: string,
): CommentReplyCursor | null {
  try {
    const padded = value.replaceAll("-", "+").replaceAll("_", "/");
    const decoded = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, "="));
    const payload = JSON.parse(decoded) as Partial<
      CommentReplyCursor & { version: number }
    >;
    if (
      payload.version !== COMMENT_REPLY_CURSOR_VERSION ||
      typeof payload.createdAt !== "string" ||
      typeof payload.id !== "string" ||
      typeof payload.rootId !== "string"
    ) {
      return null;
    }
    const createdAt = new Date(payload.createdAt);
    if (Number.isNaN(createdAt.getTime())) return null;
    return {
      createdAt: createdAt.toISOString(),
      id: payload.id,
      rootId: payload.rootId,
    };
  } catch {
    return null;
  }
}
