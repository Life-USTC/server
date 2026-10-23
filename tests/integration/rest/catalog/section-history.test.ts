import { expect } from "@playwright/test";
import { test } from "../../../e2e/utils/owned-worker";
import { createCatalogContractFixture } from "../../../shared/catalog-contract-fixture";

test.use({ storageState: { cookies: [], origins: [] } });

for (const kind of ["course", "teacher"] as const) {
  test(`${kind}.section-history-pagination`, {
    tag: kind === "course" ? "@Course/REST" : "@Teacher/REST",
  }, async ({ request, isolatedWorker, run }) => {
    await run(async () => {
      const db = isolatedWorker.database.owner;
      const fixture = await createCatalogContractFixture(db);
      const extra = await db.$transaction(async (tx) => {
        const sections = [];
        for (let index = 0; index < 21; index++) {
          sections.push(
            await tx.section.create({
              data: {
                jwId: fixture.base + 100 + index,
                code: `${fixture.marker}-history-${index}`,
                courseId: fixture.courses[0].id,
                semesterId: fixture.semester.id,
                teachers: { connect: { id: fixture.teachers[0].id } },
                retiredAt:
                  index === 20 ? new Date("2026-01-01T00:00:00+08:00") : null,
              },
            }),
          );
        }
        return sections;
      });
      const id =
        kind === "course" ? fixture.courses[0].jwId : fixture.teachers[0].id;
      const base = `/api/catalog/${kind === "course" ? "courses" : "teachers"}/${id}/sections`;
      const ids: number[] = [];
      const rows: Array<{ id: number; retiredAt: string | null }> = [];
      for (let page = 1; page <= 3; page++) {
        const response = await request.get(base, {
          params: { page, pageSize: 10, locale: "en-us" },
        });
        expect(response.status()).toBe(200);
        expect(response.headers()["cache-control"]).toContain("public");
        const body = await response.json();
        expect(body.pagination).toEqual({
          page,
          pageSize: 10,
          total: 22,
          totalPages: 3,
        });
        expect(body.data).toHaveLength(page === 3 ? 2 : 10);
        for (const section of body.data) {
          ids.push(section.id);
          rows.push(section);
          expect(section.course.namePrimary).toBe(fixture.courses[0].nameEn);
          expect(
            section.teachers.map((teacher: { id: number }) => teacher.id),
          ).toEqual([fixture.teachers[0].id]);
        }
        expect(JSON.stringify(body)).not.toContain(fixture.teachers[0].email);
      }
      expect(ids).toEqual([
        fixture.sections[0].id,
        ...extra.map((section) => section.id),
      ]);
      expect(new Set(ids).size).toBe(22);
      expect(
        rows
          .filter((section) => section.retiredAt !== null)
          .map((section) => section.id),
      ).toEqual([extra[20].id]);
      const publicList = await request.get("/api/catalog/sections", {
        params:
          kind === "course"
            ? { courseId: fixture.courses[0].id, pageSize: 100 }
            : { teacherId: fixture.teachers[0].id, pageSize: 100 },
      });
      expect(publicList.status()).toBe(200);
      const discovery = await publicList.json();
      expect(discovery.pagination.total).toBe(21);
      expect(
        discovery.data.map((section: { id: number }) => section.id),
      ).not.toContain(extra[20].id);

      const chinese = await request.get(base, {
        headers: { cookie: "NEXT_LOCALE=en-us", "accept-language": "en-US" },
      });
      expect((await chinese.json()).data[0].course.namePrimary).toBe(
        fixture.courses[0].nameCn,
      );
      const empty = await request.get(base, {
        params: { page: 4, pageSize: 10 },
      });
      expect((await empty.json()).data).toEqual([]);
      const invalidQueries: Array<Record<string, string | number>> = [
        { page: 0 },
        { pageSize: 101 },
        { locale: "invalid" },
      ];
      for (const params of invalidQueries) {
        const invalid = await request.get(base, { params });
        expect(invalid.status()).toBe(400);
        await invalid.body();
      }
      const missing = await request.get(
        base.replace(`/${id}/`, "/2147483647/"),
      );
      expect(missing.status()).toBe(404);
      await missing.body();
    });
  });
}
