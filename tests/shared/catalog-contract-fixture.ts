import type { TestPrismaClient } from "./prisma";

export async function createCatalogContractFixture(db: TestPrismaClient) {
  const base = 1600000000 + Math.floor(Math.random() * 100000000);
  const marker = `catalog-${crypto.randomUUID().slice(0, 8)}`;
  const semester = await db.semester.create({
    data: { jwId: base, code: marker, nameCn: "2026秋" },
  });
  const departments = await Promise.all(
    [0, 1].map((index) =>
      db.department.create({
        data: {
          jwId: base + index,
          code: `${marker}-${index}`,
          nameCn: `契约院系${index}`,
          nameEn: `Contract Department ${index}`,
          isCollege: true,
        },
      }),
    ),
  );
  const titles = await Promise.all(
    [0, 1].map((index) =>
      db.teacherTitle.create({
        data: {
          jwId: base + index,
          code: `${marker}-title-${index}`,
          nameCn: `契约职称${index}`,
          nameEn: `Contract Title ${index}`,
        },
      }),
    ),
  );
  const teachers = await Promise.all(
    [0, 1].map((index) =>
      db.teacher.create({
        data: {
          jwId: base + index,
          personId: base + index + 10,
          code: `${marker}-teacher-${index}`,
          nameCn: `同名教师${marker}`,
          nameEn: `Same Name Teacher ${marker}`,
          departmentId: departments[index].id,
          teacherTitleId: titles[index].id,
          email: `${marker}-${index}@example.test`,
          telephone: `telephone-${marker}`,
          mobile: `mobile-${marker}`,
          address: `address-${marker}`,
          age: 73,
          postcode: `source-postcode-${marker}`,
          qq: `source-qq-${marker}`,
          wechat: `source-wechat-${marker}`,
        },
      }),
    ),
  );
  const courses = await Promise.all(
    [0, 1].map((index) =>
      db.course.create({
        data: {
          jwId: base + index,
          code: `${marker}-course-${index}`,
          nameCn: `契约课程${marker}-${index}`,
          nameEn: `Contract Course ${marker}-${index}`,
        },
      }),
    ),
  );
  const sections = await Promise.all(
    [0, 1].map((index) =>
      db.section.create({
        data: {
          jwId: base + index,
          code: `${marker}-section-${index}`,
          semesterId: semester.id,
          courseId: courses[index].id,
          teachers: { connect: { id: teachers[index].id } },
        },
      }),
    ),
  );
  return {
    base,
    marker,
    semester,
    departments,
    titles,
    teachers,
    courses,
    sections,
  };
}
export type CatalogContractFixture = Awaited<
  ReturnType<typeof createCatalogContractFixture>
>;
export async function cleanupCatalogContractFixture(
  db: TestPrismaClient,
  fixture: CatalogContractFixture,
) {
  const where = { jwId: { gte: fixture.base, lt: fixture.base + 100 } };
  const sections = await db.section.findMany({ where, select: { id: true } });
  const sectionIds = sections.map((section) => section.id);
  await db.schedule.deleteMany({ where: { sectionId: { in: sectionIds } } });
  await db.scheduleGroup.deleteMany({
    where: { sectionId: { in: sectionIds } },
  });
  await db.exam.deleteMany({ where: { sectionId: { in: sectionIds } } });
  await db.teacherAssignment.deleteMany({
    where: { sectionId: { in: sectionIds } },
  });
  await db.section.deleteMany({ where });
  await db.course.deleteMany({ where });
  await db.teacher.deleteMany({ where });
  await db.teacherTitle.deleteMany({ where });
  await db.department.deleteMany({ where });
  await db.semester.deleteMany({ where });
}
