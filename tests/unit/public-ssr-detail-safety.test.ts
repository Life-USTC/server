import { getCookies } from "better-auth/cookies";
import { describe, expect, test } from "vitest";
import { buildVisibleCommentNode } from "@/features/comments/server/serialized-comment-node";
import { homeworkItemIncludeForViewer } from "@/features/homeworks/server/homework-read-model";
import { getViewerContext } from "@/lib/auth/viewer-context";
import { resolvePublicSsrMode } from "@/lib/cloudflare/public-ssr-gateway";

const anonymousViewer = {
  image: null,
  isAdmin: false,
  isAuthenticated: false,
  isSuspended: false,
  name: null,
  suspensionExpiresAt: null,
  suspensionReason: null,
  userId: null,
};

function detailRequest(headers: HeadersInit = {}) {
  return new Request("https://life-ustc.test/catalog/sections/159446", {
    headers: { accept: "text/html", ...headers },
  });
}

describe("public SSR detail safety invariants", () => {
  test("admits only the anonymous document request", () => {
    expect(resolvePublicSsrMode(detailRequest())).toBe("page");
    expect(
      resolvePublicSsrMode(
        detailRequest({ authorization: "Bearer access-token" }),
      ),
    ).toBeNull();
    expect(
      resolvePublicSsrMode(
        detailRequest({ cookie: "better-auth.session_token=session-token" }),
      ),
    ).toBeNull();
  });

  test("recognizes Better Auth's configured default production cookie", () => {
    const { sessionToken } = getCookies({ baseURL: "https://life-ustc.test" });

    expect(sessionToken.name).toBe("__Secure-better-auth.session_token");
    expect(
      resolvePublicSsrMode(
        detailRequest({ cookie: `${sessionToken.name}=session-token` }),
      ),
    ).toBeNull();
  });

  test("uses a deterministic anonymous viewer baseline", async () => {
    await expect(getViewerContext({ userId: null })).resolves.toEqual(
      anonymousViewer,
    );
  });

  test("does not select per-user homework completion state", () => {
    expect(homeworkItemIncludeForViewer(null)).not.toHaveProperty(
      "homeworkCompletions",
    );
  });

  test("does not expose anonymous reaction or moderation capabilities", () => {
    const node = buildVisibleCommentNode({
      comment: {
        body: "Public comment",
        createdAt: new Date("2026-07-29T00:00:00Z"),
        id: "comment-1",
        reactions: [
          { type: "heart", userId: "user-1" },
          { type: "heart", userId: "user-2" },
        ],
        status: "active",
        updatedAt: new Date("2026-07-29T00:00:00Z"),
        userId: "user-1",
        visibility: "public",
      },
      hasDescendant: false,
      viewer: anonymousViewer,
    });

    expect(node).toMatchObject({
      canDelete: false,
      canEdit: false,
      canModerate: false,
      canReact: false,
      canReply: false,
      isAuthor: false,
      reactions: [{ count: 2, type: "heart", viewerHasReacted: false }],
    });
  });

  test.each([
    { status: "softbanned" as const, visibility: "public" as const },
    { status: "active" as const, visibility: "logged_in_only" as const },
  ])("hides non-public comment state from the anonymous baseline", (state) => {
    expect(
      buildVisibleCommentNode({
        comment: {
          ...state,
          body: "Private comment",
          createdAt: new Date("2026-07-29T00:00:00Z"),
          id: "comment-private",
          updatedAt: new Date("2026-07-29T00:00:00Z"),
          userId: "user-1",
        },
        hasDescendant: false,
        viewer: anonymousViewer,
      }),
    ).toBeNull();
  });
});
