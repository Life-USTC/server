import { expect } from "@playwright/test";
import { test } from "../../../e2e/utils/owned-worker";

for (const kind of ["section", "course"] as const) {
  test(`subscription.literal-code-matching ${kind}`, {
    tag: "@Subscription/REST",
  }, async ({ isolatedWorker, run }) => {
    await run(async () => {
      const db = isolatedWorker.database.owner;
      const actor = await isolatedWorker.createActor();
      const semester = await db.semester.create({
        data: { jwId: 1, code: "CODE-MATCH", nameCn: "编号匹配学期" },
      });
      const target = await db.course.create({
        data: { jwId: 1, code: "CS_%", nameCn: "目标课程" },
      });
      const decoy = await db.course.create({
        data: { jwId: 2, code: "CS_AX", nameCn: "相似编号课程" },
      });
      const exact = await db.section.create({
        data: {
          jwId: 1,
          code: "CS_%.01",
          courseId: target.id,
          semesterId: semester.id,
        },
      });
      const sameCourse = await db.section.create({
        data: {
          jwId: 2,
          code: "OTHER.02",
          courseId: target.id,
          semesterId: semester.id,
        },
      });
      await db.section.create({
        data: {
          jwId: 3,
          code: "CS_AX.01",
          courseId: decoy.id,
          semesterId: semester.id,
        },
      });

      const code = kind === "section" ? "cs_%.01" : "cs_%";
      const response = await actor.request.post(
        "/api/workspace/subscriptions/query",
        { data: { codes: [` ${code} `], semesterId: semester.id } },
      );
      expect(response.status()).toBe(200);
      const result = await response.json();
      expect(result.matchedCodes).toEqual([code]);
      expect(result.unmatchedCodes).toEqual([]);
      expect(
        result.sections.map((section: { id: number }) => section.id).sort(),
      ).toEqual(
        (kind === "section" ? [exact.id] : [exact.id, sameCourse.id]).sort(),
      );
      expect(await db.userSectionSubscription.findMany()).toEqual([]);
    });
  });
}
