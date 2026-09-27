import { withE2ePrisma } from "./e2e-db/prisma";
import {
  createPublicationFixture,
  deletePublicationFixture,
} from "./e2e-db/publications";

export async function createPublicBrowsePolicyFixture() {
  const marker = `browse-${crypto.randomUUID().slice(0, 10)}`;
  const base = 1_400_000_000 + Math.floor(Math.random() * 100_000_000);
  const fixture = await withE2ePrisma(async (db) => {
    const education = await db.educationLevel.create({
      data: { nameCn: `层次${marker}`, nameEn: `Level ${marker}` },
    });
    const category = await db.courseCategory.create({
      data: { nameCn: `类别${marker}`, nameEn: `Category ${marker}` },
    });
    const classType = await db.classType.create({
      data: { nameCn: `类型${marker}`, nameEn: `Class ${marker}` },
    });
    const department = await db.department.create({
      data: {
        code: marker,
        nameCn: `学院${marker}`,
        nameEn: `Department ${marker}`,
      },
    });
    const campus = await db.campus.create({
      data: {
        jwId: base + 1000,
        nameCn: `校区${marker}`,
        nameEn: `Campus ${marker}`,
      },
    });
    const semester = await db.semester.create({
      data: {
        jwId: base + 1001,
        code: marker,
        nameCn: "2026-2027学年第一学期",
      },
    });
    const courses = [];
    const teachers = [];
    const sections = [];
    const organizers = [];
    for (let index = 0; index < 25; index++) {
      const suffix = String(index).padStart(2, "0");
      const course = await db.course.create({
        data: {
          jwId: base + index,
          code: `${marker}-C-${suffix}`,
          nameCn: `${marker} 课程 ${suffix} 用于检查紧凑列表与长名称阅读`,
          nameEn: `${marker} course ${suffix} with a complete descriptive name for compact list reading`,
          educationLevelId: education.id,
          categoryId: category.id,
          classTypeId: classType.id,
        },
      });
      const teacher = await db.teacher.create({
        data: {
          jwId: base + 100 + index,
          code: `${marker}-T-${suffix}`,
          nameCn: `${marker} 教师 ${suffix}`,
          nameEn: `${marker} teacher ${suffix} with a distinguishing full name`,
          departmentId: department.id,
        },
      });
      const section = await db.section.create({
        data: {
          jwId: base + 200 + index,
          code: `${marker}-S-${suffix}`,
          courseId: course.id,
          teachers: { connect: { id: teacher.id } },
          semesterId: semester.id,
          campusId: campus.id,
          openDepartmentId: department.id,
          credits: 4,
          stdCount: 12,
          limitCount: 48,
        },
      });
      courses.push(course);
      teachers.push(teacher);
      sections.push(section);
      organizers.push(
        await db.youngOrganizer.create({
          data: {
            id: `${marker}-O-${suffix}`,
            normalizedName: `${marker}-O-${suffix}`,
            name: `${marker} organizer ${suffix} with a complete public organization name`,
          },
        }),
      );
    }
    for (let index = 0; index < 25; index++) {
      await db.youngEvent.create({
        data: {
          youngId: `${marker}-E-${index}`,
          name: `${marker} event ${String(index).padStart(2, "0")} with a complete public activity title`,
          organizerId: organizers[0].id,
          organizer: organizers[0].name,
          category: marker,
          module: "智",
          activityLevel: "校级",
          isActive: true,
          startAt: new Date("2035-09-15T10:00:00+08:00"),
          endAt: new Date("2035-09-15T12:00:00+08:00"),
          applyStartAt: new Date("2035-09-14T08:00:00+08:00"),
          applyEndAt: new Date("2035-09-14T12:00:00+08:00"),
          rawJson: {},
        },
      });
      if (index > 0)
        await db.youngEvent.create({
          data: {
            youngId: `${marker}-support-${index}`,
            name: `Support ${index}`,
            organizerId: organizers[index].id,
            isActive: true,
            rawJson: {},
          },
        });
    }
    return {
      education,
      category,
      classType,
      department,
      campus,
      semester,
      courses,
      teachers,
      sections,
      organizers,
    };
  });
  const publications = await createPublicationFixture(marker);
  return { ...fixture, publications, marker };
}

export type PublicBrowsePolicyFixture = Awaited<
  ReturnType<typeof createPublicBrowsePolicyFixture>
>;

export async function cleanupPublicBrowsePolicyFixture(
  fixture: PublicBrowsePolicyFixture,
) {
  await deletePublicationFixture(fixture.publications);
  await withE2ePrisma(async (db) => {
    await db.youngEvent.deleteMany({
      where: { youngId: { startsWith: fixture.marker } },
    });
    await db.youngOrganizer.deleteMany({
      where: { id: { in: fixture.organizers.map((x) => x.id) } },
    });
    await db.section.deleteMany({
      where: { id: { in: fixture.sections.map((x) => x.id) } },
    });
    await db.teacher.deleteMany({
      where: { id: { in: fixture.teachers.map((x) => x.id) } },
    });
    await db.course.deleteMany({
      where: { id: { in: fixture.courses.map((x) => x.id) } },
    });
    await db.semester.delete({ where: { id: fixture.semester.id } });
    await db.campus.delete({ where: { id: fixture.campus.id } });
    await db.department.delete({ where: { id: fixture.department.id } });
    await db.classType.delete({ where: { id: fixture.classType.id } });
    await db.courseCategory.delete({ where: { id: fixture.category.id } });
    await db.educationLevel.delete({ where: { id: fixture.education.id } });
  });
}

export function publicBrowseCases(f: PublicBrowsePolicyFixture) {
  const query = (path: string, params: Record<string, string | number>) =>
    `${path}?${new URLSearchParams(Object.entries(params).map(([key, value]) => [key, String(value)]))}`;
  return [
    {
      name: "courses",
      path: query("/catalog/courses", {
        search: f.marker,
        educationLevelId: f.education.id,
        categoryId: f.category.id,
        classTypeId: f.classType.id,
      }),
      total: 25,
    },
    {
      name: "teachers",
      path: query("/catalog/teachers", {
        search: f.marker,
        departmentId: f.department.id,
      }),
      total: 25,
    },
    {
      name: "sections",
      path: query("/catalog/sections", {
        search: f.marker,
        courseCode: f.marker,
        sectionCode: f.marker,
        teacher: f.marker,
        credits: 4,
        semesterId: f.semester.id,
        campusId: f.campus.id,
        departmentId: f.department.id,
        educationLevelId: f.education.id,
        categoryId: f.category.id,
        classTypeId: f.classType.id,
        sort: "code",
        order: "asc",
      }),
      total: 25,
    },
    {
      name: "events",
      path: query("/catalog/young-events", {
        search: `${f.marker} event`,
        active: "true",
        dateUnknown: "false",
        category: f.marker,
        module: "智",
        activityLevel: "校级",
        organizerId: f.organizers[0].id,
        timeBasis: "activity",
      }),
      total: 25,
    },
    {
      name: "organizers",
      path: query("/catalog/young-events/organizers", { search: f.marker }),
      total: 25,
    },
    {
      name: "news",
      path: query("/news", {
        query: f.marker,
        source: f.publications.sourceId,
        organizationLevel: "university",
        type: "news",
        fold: "1",
      }),
      total: f.publications.total,
    },
  ];
}
