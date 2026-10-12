import type { Prisma } from "../../../src/generated/prisma-node/client";

export async function createCountActor(db: Prisma.TransactionClient) {
  const marker = `count-${crypto.randomUUID()}`;
  const owner = await db.user.create({
    data: {
      id: crypto.randomUUID(),
      name: "Count grammar administrator",
      username: "countgrammar",
      email: `${marker}@example.test`,
      isAdmin: true,
    },
  });
  return { marker, owner };
}

/** Sections are prerequisites shared by import and moderation count consumers. */
export async function createCountSections(
  db: Prisma.TransactionClient,
  count: number,
) {
  const identity = await createCountActor(db);
  const base = 1_200_000_000 + Math.floor(Math.random() * 100_000_000);
  const semester = await db.semester.create({
    data: {
      jwId: base,
      code: identity.marker,
      nameCn: "2026-2027学年第一学期",
    },
  });
  const course = await db.course.create({
    data: {
      jwId: base + 1,
      code: `CNP${base}`,
      nameCn: "计数语法测试课程",
      nameEn: "Count grammar course",
    },
  });
  const sections = [];
  for (let index = 0; index < count; index++) {
    sections.push(
      await db.section.create({
        data: {
          jwId: base + 10 + index,
          code: `${course.code}.${String(index + 1).padStart(2, "0")}`,
          courseId: course.id,
          semesterId: semester.id,
        },
      }),
    );
  }
  return { ...identity, semester, course, sections };
}
