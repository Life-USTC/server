import { expect } from "@playwright/test";
import { subscribedExamsResponseSchema } from "@/lib/api/schemas/subscribed-exams-schemas";
import { test } from "../../calendar-subscriptions/_fixture";

const base = "/api/workspace/exams";

test("anonymous exam read returns JSON 401", async ({ request }) => {
  const response = await request.get(base);
  expect(response.status()).toBe(401);
  expect((await response.json()).error).toEqual(expect.any(String));
});

test("known exams paginate privately with section and semester context", async ({
  calendarState,
}) => {
  const { db, owner, other, section } = calendarState;
  await db.userSectionSubscription.create({
    data: { userId: owner.id, sectionId: section.id },
  });
  const exams = [];
  for (const [index, date] of ["2026-04-29", "2026-04-30"].entries()) {
    exams.push(
      await db.exam.create({
        data: {
          jwId: section.jwId + index,
          sectionId: section.id,
          examDate: new Date(`${date}T00:00:00Z`),
          startTime: 1400,
          endTime: 1600,
          examType: 1,
          examMode: "closed",
        },
      }),
    );
  }
  for (const [index, exam] of exams.entries()) {
    const response = await owner.request.get(
      `${base}?pageSize=1&page=${index + 1}`,
    );
    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).toContain("private");
    const body = subscribedExamsResponseSchema.parse(await response.json());
    expect(body.pagination).toMatchObject({
      pageSize: 1,
      page: index + 1,
      total: 2,
      totalPages: 2,
    });
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject({
      jwId: exam.jwId,
      section: {
        id: section.id,
        semester: { id: section.semesterId, nameCn: expect.any(String) },
      },
    });
    expect(body.data[0].section.semester.nameCn).not.toBe("");
  }
  const unrelated = await other.request.get(base);
  expect(unrelated.status()).toBe(200);
  expect(await unrelated.json()).toMatchObject({
    data: [],
    pagination: { total: 0 },
  });
});

test("date filters include unknown dates only when requested", async ({
  calendarState,
}) => {
  const { db, owner, section } = calendarState;
  await db.userSectionSubscription.create({
    data: { userId: owner.id, sectionId: section.id },
  });
  const unknown = await db.exam.create({
    data: { jwId: section.jwId, sectionId: section.id },
  });
  await db.exam.create({
    data: {
      jwId: section.jwId + 1,
      sectionId: section.id,
      examDate: new Date("2026-04-28"),
    },
  });
  for (const includeDateUnknown of [true, false]) {
    const response = await owner.request.get(
      `${base}?dateFrom=2026-04-29&dateTo=2026-04-29&includeDateUnknown=${includeDateUnknown}`,
    );
    expect(response.status()).toBe(200);
    expect(
      (await response.json()).data.map((exam: { jwId: number }) => exam.jwId),
    ).toEqual(includeDateUnknown ? [unknown.jwId] : []);
  }
});

for (const query of [
  "dateFrom=invalid",
  "dateFrom=2026-09-16&dateTo=2026-09-15",
  "pageSize=101",
  "includeDateUnknown=invalid",
]) {
  test(`exam read rejects ${query}`, async ({ createActor }) => {
    const owner = await createActor();
    const response = await owner.request.get(`${base}?${query}`);
    expect(response.status()).toBe(400);
    expect((await response.json()).error).toEqual(expect.any(String));
  });
}
