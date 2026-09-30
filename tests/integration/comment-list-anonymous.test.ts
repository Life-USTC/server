import { describe, expect } from "vitest";
import { getCommentsRoute } from "@/lib/api/routes/comments-list-route";
import { nodeProtocolTest } from "../shared/node-protocol-fixture";

const it = nodeProtocolTest.extend(
  "targets",
  async ({ isolatedDatabase: { owner: db }, protocolRuntime }) =>
    protocolRuntime.run(() =>
      db.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: "comment-author@test.invalid",
            name: "Comment author",
          },
        });
        const course = await tx.course.create({
          data: { jwId: 1, code: "anonymous", nameCn: "Anonymous comments" },
        });
        const section = await tx.section.create({
          data: { jwId: 1, code: "anonymous", courseId: course.id },
        });
        const teacher = await tx.teacher.create({
          data: { jwId: 1, code: "anonymous", nameCn: "Comment teacher" },
        });
        const young = await tx.youngEvent.create({
          data: {
            youngId: "anonymous-comments",
            name: "Comment event",
            isActive: true,
            rawJson: {},
          },
        });
        const targets = [];
        for (const [query, reference] of [
          [
            `targetType=section&sectionJwId=${section.jwId}`,
            { sectionId: section.id },
          ],
          [
            `targetType=course&courseJwId=${course.jwId}`,
            { courseId: course.id },
          ],
          [
            `targetType=teacher&teacherId=${teacher.id}`,
            { teacherId: teacher.id },
          ],
          [
            `targetType=young-event&youngId=${young.youngId}`,
            { youngEventId: young.id },
          ],
        ] as const) {
          const visible = await tx.comment.create({
            data: { ...reference, userId: user.id, body: "Public comment" },
          });
          await tx.comment.create({
            data: {
              ...reference,
              userId: user.id,
              body: "Private comment body",
              visibility: "logged_in_only",
            },
          });
          targets.push({ query, visibleId: visible.id });
        }
        return targets;
      }),
    ),
);

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
  it("lists section comments without a viewer and reports a hidden count", async ({
    targets,
    protocolRuntime,
  }) => {
    await protocolRuntime.run(async () => {
      const response = await protocolRuntime.request(() =>
        getAnonymously(targets[0].query),
      );
      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        data?: { id: string }[];
        meta?: { hiddenCount?: number; viewer?: { isAuthenticated?: boolean } };
      };
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.meta?.viewer?.isAuthenticated).toBe(false);
      expect(typeof body.meta?.hiddenCount).toBe("number");
      expect(body.meta?.hiddenCount).toBeGreaterThanOrEqual(0);
      expect(body.data?.map((row) => row.id)).toEqual([targets[0].visibleId]);
      expect(body.meta?.hiddenCount).toBe(1);
      expect(JSON.stringify(body)).not.toContain("Private comment body");
    });
  });

  it("resolves every anonymous comment target type", async ({
    targets,
    protocolRuntime,
  }) => {
    await protocolRuntime.run(async () => {
      for (const { query, visibleId } of targets) {
        const response = await protocolRuntime.request(() =>
          getAnonymously(query),
        );
        expect(response.status, query).toBe(200);
        const body = await response.json();
        expect(body.data.map((row: { id: string }) => row.id)).toEqual([
          visibleId,
        ]);
        expect(body.meta.hiddenCount).toBe(1);
        expect(JSON.stringify(body)).not.toContain("Private comment body");
      }
    });
  });
});
