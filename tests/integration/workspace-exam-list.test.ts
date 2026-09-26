import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { listSubscribedExamPage } from "@/features/subscriptions/server/subscription-read-model";
import {
  subscribedExamDtoSchema,
  subscribedExamsQuerySchema,
  subscribedExamsResponseSchema,
} from "@/lib/api/schemas/subscribed-exams-schemas";
import { prisma as runtimePrisma } from "@/lib/db/prisma";
import { serializeDatesDeep } from "@/lib/time/serialize-date-output";
import { createFixturePrisma } from "../shared/prisma";

const db = createFixturePrisma();
const users = [crypto.randomUUID(), crypto.randomUUID()];
const sectionIds: number[] = [];
const semesterIds: number[] = [];
const examIds: number[] = [];
const jwBase = -Math.floor(Math.random() * 100000000) - 100;

beforeAll(async () => {
  const source = await db.section.findFirstOrThrow({
    select: { courseId: true },
  });
  for (let i = 0; i < 2; i += 1) {
    const semester = await db.semester.create({
      data: {
        jwId: jwBase - i,
        code: `test-${crypto.randomUUID()}`,
        nameCn: `Semester ${i}`,
      },
    });
    semesterIds.push(semester.id);
  }
  await db.user.createMany({
    data: users.map((id) => ({
      id,
      email: `${id}@test.invalid`,
      name: "Exam list test",
    })),
  });
  for (let i = 0; i < 3; i += 1) {
    const section = await db.section.create({
      data: {
        courseId: source.courseId,
        semesterId: semesterIds[i % 2],
        jwId: jwBase - i,
        code: `[integration-test] exam-${crypto.randomUUID()}`,
      },
    });
    sectionIds.push(section.id);
    await db.userSectionSubscription.create({
      data: { sectionId: section.id, userId: users[i === 2 ? 1 : 0] },
    });
  }
  for (let i = 0; i < 5; i += 1) {
    const exam = await db.exam.create({
      data: {
        jwId: jwBase - i,
        sectionId: sectionIds[Math.floor(i / 2)],
        examDate: i === 3 ? null : new Date(`2026-09-${14 + i}T00:00:00Z`),
        startTime: 900,
        endTime: 1100,
      },
    });
    examIds.push(exam.id);
  }
});
afterAll(async () => {
  await db.section.deleteMany({ where: { id: { in: sectionIds } } });
  await db.semester.deleteMany({ where: { id: { in: semesterIds } } });
  await db.user.deleteMany({ where: { id: { in: users } } });
  await Promise.all([db.$disconnect(), runtimePrisma.$disconnect()]);
});

async function read(userId: string, input: Record<string, string> = {}) {
  const { page, pageSize, locale, ...filters } =
    subscribedExamsQuerySchema.parse(input);
  const result = await listSubscribedExamPage(userId, {
    ...filters,
    locale,
    pagination: { page, pageSize },
  });
  return subscribedExamsResponseSchema.parse({
    ...result,
    data: result.data.map((exam) =>
      subscribedExamDtoSchema.parse(serializeDatesDeep(exam)),
    ),
  });
}

describe("complete subscribed exam pages", () => {
  it("returns four owned exams across real pages with semester context and unknown dates", async () => {
    const first = await read(users[0], { pageSize: "2" });
    const second = await read(users[0], { page: "2", pageSize: "2" });
    expect(first.pagination).toEqual({
      page: 1,
      pageSize: 2,
      total: 4,
      totalPages: 2,
    });
    expect(second.pagination).toEqual({
      page: 2,
      pageSize: 2,
      total: 4,
      totalPages: 2,
    });
    expect([...first.data, ...second.data].map((exam) => exam.id)).toEqual(
      examIds.slice(0, 4),
    );
    expect(second.data[1].examDate).toBeNull();
    expect(second.data[1].section.semester?.nameCn).toBe("Semester 1");
    expect((await read(users[1])).data.map((exam) => exam.id)).toEqual([
      examIds[4],
    ]);
    expect((await read(users[0], { page: "3", pageSize: "2" })).data).toEqual(
      [],
    );
  });
  it("filters normalized Shanghai dates and semester before counting and paging", async () => {
    const filtered = await read(users[0], {
      dateFrom: "2026-09-14T20:00:00Z",
      dateTo: "2026-09-15",
      includeDateUnknown: "false",
    });
    expect(filtered.data.map((exam) => exam.id)).toEqual([examIds[1]]);
    const unknownIncluded = await read(users[0], {
      dateFrom: "2026-09-15",
      dateTo: "2026-09-15",
    });
    expect(unknownIncluded.data.map((exam) => exam.id)).toEqual([
      examIds[1],
      examIds[3],
    ]);
    const semester = await read(users[0], {
      semesterId: String(semesterIds[1]),
      pageSize: "1",
    });
    expect(semester.pagination.total).toBe(2);
    expect(semester.data[0].id).toBe(examIds[2]);
  });
});
