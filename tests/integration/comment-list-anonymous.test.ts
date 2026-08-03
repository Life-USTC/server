import { afterAll, describe, expect, it } from "vitest";
import { getCommentsRoute } from "@/lib/api/routes/comments-list-route";
import { prisma } from "@/lib/db/prisma";
import { DEV_SEED } from "../fixtures/dev-seed";

/**
 * The anonymous branch of `loadCommentThread` is the only caller of the
 * `comment_hidden_root_count` SQL function, so it is the only path that fails
 * when that function is missing or its privileges drift. Signed-in requests
 * skip it entirely, which is how a broken deploy reached production unnoticed.
 */
async function getAnonymously(query: string) {
  return getCommentsRoute(
    new Request(`https://example.test/api/community/comments?${query}`),
  );
}

describe("GET /api/community/comments (anonymous)", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("lists section comments without a viewer and reports a hidden count", async () => {
    const response = await getAnonymously(
      `targetType=section&sectionJwId=${DEV_SEED.section.jwId}`,
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data?: unknown[];
      meta?: { hiddenCount?: number; viewer?: { isAuthenticated?: boolean } };
    };
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.meta?.viewer?.isAuthenticated).toBe(false);
    expect(typeof body.meta?.hiddenCount).toBe("number");
    expect(body.meta?.hiddenCount).toBeGreaterThanOrEqual(0);
  });

  it("resolves every anonymous comment target type", async () => {
    const teacher = await prisma.teacher.findFirstOrThrow({
      where: { code: DEV_SEED.teacher.code },
      select: { id: true },
    });

    for (const query of [
      `targetType=section&sectionJwId=${DEV_SEED.section.jwId}`,
      `targetType=course&courseJwId=${DEV_SEED.course.jwId}`,
      `targetType=teacher&teacherId=${teacher.id}`,
    ]) {
      const response = await getAnonymously(query);
      expect(response.status, query).toBe(200);
    }
  });
});
