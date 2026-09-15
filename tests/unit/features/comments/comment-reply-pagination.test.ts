import { describe, expect, it } from "vitest";
import {
  decodeCommentReplyCursor,
  encodeCommentReplyCursor,
} from "@/features/comments/server/comment-reply-pagination";

describe("comment reply cursors", () => {
  it("round-trips an opaque cursor with a stable timestamp/id key", () => {
    const cursor = {
      createdAt: "2026-01-01T00:00:00.000Z",
      id: "reply-10",
      rootId: "root-1",
    };

    expect(decodeCommentReplyCursor(encodeCommentReplyCursor(cursor))).toEqual(
      cursor,
    );
  });

  it("rejects malformed, tampered, and invalid-date cursors", () => {
    const encoded = encodeCommentReplyCursor({
      createdAt: "2026-01-01T00:00:00.000Z",
      id: "reply-10",
      rootId: "root-1",
    });

    expect(decodeCommentReplyCursor("not-a-cursor")).toBeNull();
    expect(decodeCommentReplyCursor(`${encoded}*`)).toBeNull();
    expect(
      decodeCommentReplyCursor(
        encodeCommentReplyCursor({
          createdAt: "not-a-date",
          id: "reply-10",
          rootId: "root-1",
        }),
      ),
    ).toBeNull();
  });
});
