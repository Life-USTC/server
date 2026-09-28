import type { Prisma } from "../../src/generated/prisma-node/client";
import type { TestPrismaClient } from "./prisma";

export async function createCatalogContractFixture(client: {
  $transaction<T>(
    run: (db: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T>;
}) {
  return client.$transaction(async (db) => {
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
      cleanupIds: {
        sections: sections.map(({ id }) => id),
        courses: courses.map(({ id }) => id),
        teachers: teachers.map(({ id }) => id),
        titles: titles.map(({ id }) => id),
        departments: departments.map(({ id }) => id),
        semesters: [semester.id],
      },
    };
  });
}
export type CatalogContractFixture = Awaited<
  ReturnType<typeof createCatalogContractFixture>
>;
export async function cleanupCatalogContractFixture(
  db: TestPrismaClient,
  fixture: CatalogContractFixture,
) {
  // Extra records created by a case must be registered explicitly by exact ID.
  // A random JW-ID range is not an ownership boundary.
  const ids = fixture.cleanupIds;
  const sectionIds = ids.sections;
  await db.$transaction(async (db) => {
    await db.schedule.deleteMany({ where: { sectionId: { in: sectionIds } } });
    await db.scheduleGroup.deleteMany({
      where: { sectionId: { in: sectionIds } },
    });
    await db.exam.deleteMany({ where: { sectionId: { in: sectionIds } } });
    await db.teacherAssignment.deleteMany({
      where: { sectionId: { in: sectionIds } },
    });
    await db.section.deleteMany({ where: { id: { in: ids.sections } } });
    await db.course.deleteMany({ where: { id: { in: ids.courses } } });
    await db.teacher.deleteMany({ where: { id: { in: ids.teachers } } });
    await db.teacherTitle.deleteMany({ where: { id: { in: ids.titles } } });
    await db.department.deleteMany({ where: { id: { in: ids.departments } } });
    await db.semester.deleteMany({ where: { id: { in: ids.semesters } } });
  });
}
