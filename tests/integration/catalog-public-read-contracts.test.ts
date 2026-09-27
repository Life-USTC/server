import { afterAll, afterEach, beforeEach, expect, it } from "vitest";
import { getCoursePage } from "@/features/catalog/server/course-page-data";
import {
  findCourseDetailByJwId,
  findSectionDetailByJwId,
} from "@/features/catalog/server/course-section-read-queries";
import { listSectionSummaries } from "@/features/catalog/server/section-summary-read-model";
import { getTeacherPage } from "@/features/catalog/server/teacher-page-data";
import { findTeacherDetailById } from "@/features/catalog/server/teacher-summary-read-model";
import { getSectionPage } from "@/features/section-detail/server/section-page-data";
import { runWithCloudflareRuntimeEnv } from "@/lib/adapters/cloudflare-runtime";
import { resetPublicRuntimeCacheForTest } from "@/lib/public-runtime-cache";
import {
  type CatalogContractFixture,
  cleanupCatalogContractFixture,
  createCatalogContractFixture,
} from "../shared/catalog-contract-fixture";
import { createFixturePrisma } from "../shared/prisma";

const db = createFixturePrisma();
let fixture: CatalogContractFixture;
let originalRevision: Awaited<
  ReturnType<typeof db.staticImportState.findUnique>
>;
beforeEach(async () => {
  resetPublicRuntimeCacheForTest();
  originalRevision = await db.staticImportState.findUnique({
    where: { id: "global" },
  });
  fixture = await createCatalogContractFixture(db);
});
afterEach(async () => {
  await cleanupCatalogContractFixture(db, fixture);
  if (originalRevision)
    await db.staticImportState.upsert({
      where: { id: "global" },
      create: originalRevision,
      update: originalRevision,
    });
  else await db.staticImportState.deleteMany({ where: { id: "global" } });
  resetPublicRuntimeCacheForTest();
});
afterAll(() => db.$disconnect());
function request<T>(read: () => Promise<T>) {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("Missing app runtime database URL");
  return runWithCloudflareRuntimeEnv(
    { HYPERDRIVE: { connectionString } },
    read,
  );
}
async function commitRevision() {
  const data = {
    snapshotSha256: crypto.randomUUID().replaceAll("-", "").repeat(2),
    snapshotGeneratedAt: new Date(),
    transformRevision: 6,
  };
  await db.staticImportState.upsert({
    where: { id: "global" },
    create: { id: "global", ...data },
    update: data,
  });
}

it("course.public-detail-cache", async () => {
  const [a, b] = fixture.courses;
  expect(
    (await request(() => findCourseDetailByJwId(a.jwId, "zh-cn")))?.namePrimary,
  ).toBe(a.nameCn);
  expect(
    (await request(() => findCourseDetailByJwId(b.jwId, "en-us")))?.namePrimary,
  ).toBe(b.nameEn);
  expect(
    (await request(() => findCourseDetailByJwId(a.jwId, "en-us")))?.namePrimary,
  ).toBe(a.nameEn);
  const page = await request(() => getCoursePage(a.jwId, "zh-cn"));
  expect(page?.id).toBe(a.id);
  expect(page?.sections).toHaveLength(1);
  expect(page).not.toHaveProperty("classifyId");
  const api = await request(() => findCourseDetailByJwId(a.jwId, "zh-cn"));
  expect(api).toHaveProperty("sections");
  expect(api).toHaveProperty("classifyId");
  expect(api).not.toHaveProperty("course");
  await db.course.update({
    where: { id: a.id },
    data: { nameCn: "已导入的新课程" },
  });
  expect(
    (await request(() => findCourseDetailByJwId(a.jwId)))?.namePrimary,
  ).toBe(a.nameCn);
  const missing = fixture.base + 99;
  expect(await request(() => findCourseDetailByJwId(missing))).toBeNull();
  await db.course.create({
    data: { jwId: missing, code: `${fixture.marker}-new`, nameCn: "新课程" },
  });
  await commitRevision();
  expect(
    (await request(() => findCourseDetailByJwId(a.jwId)))?.namePrimary,
  ).toBe("已导入的新课程");
  expect((await request(() => getCoursePage(a.jwId)))?.namePrimary).toBe(
    "已导入的新课程",
  );
  expect(
    (await request(() => findCourseDetailByJwId(missing)))?.namePrimary,
  ).toBe("新课程");
});

it("section.public-detail-cache", async () => {
  const [a, b] = fixture.sections;
  const [courseA, courseB] = fixture.courses;
  const group = await db.scheduleGroup.create({
    data: {
      jwId: fixture.base,
      sectionId: a.id,
      no: 1,
      limitCount: 20,
      stdCount: 10,
      actualPeriods: 1,
      isDefault: true,
    },
  });
  await db.schedule.create({
    data: {
      sectionId: a.id,
      scheduleGroupId: group.id,
      startUnit: 1,
      endUnit: 2,
      date: new Date("2026-09-28"),
      weekday: 1,
      periods: 1,
      weekIndex: 1,
      startTime: 800,
      endTime: 900,
    },
  });
  await db.teacherAssignment.create({
    data: {
      sectionId: a.id,
      teacherId: fixture.teachers[0].id,
      role: "lecturer",
      period: 1,
    },
  });
  const shape = {
    includeExams: false,
    includeSchedules: false,
    includeTeacherDepartments: false,
  };
  const lean = await request(() =>
    findSectionDetailByJwId(a.jwId, "zh-cn", shape),
  );
  expect(lean?.schedules).toEqual([]);
  expect(lean?.teacherAssignments).toEqual([]);
  const full = await request(() => findSectionDetailByJwId(a.jwId, "en-us"));
  expect(full?.course.namePrimary).toBe(courseA.nameEn);
  expect(full?.schedules).toHaveLength(1);
  expect(full?.teacherAssignments).toHaveLength(1);
  expect(
    (await request(() => findSectionDetailByJwId(a.jwId, "zh-cn")))?.schedules,
  ).toHaveLength(1);
  expect(full?.teachers[0].department?.id).toBe(fixture.departments[0].id);
  expect(
    (await request(() => findSectionDetailByJwId(b.jwId)))?.course.namePrimary,
  ).toBe(courseB.nameCn);
  expect(
    (await request(() => findSectionDetailByJwId(a.jwId, "zh-cn", shape)))
      ?.schedules,
  ).toEqual([]);
  expect((await request(() => getSectionPage(a.jwId)))?.section.id).toBe(a.id);
  await db.section.update({
    where: { id: a.id },
    data: { code: "UPDATED-SECTION" },
  });
  expect(
    (await request(() => findSectionDetailByJwId(a.jwId, "zh-cn", shape)))
      ?.code,
  ).toBe(a.code);
  const missing = fixture.base + 99;
  expect(await request(() => findSectionDetailByJwId(missing))).toBeNull();
  await db.section.create({
    data: {
      jwId: missing,
      code: "NEW-SECTION",
      courseId: courseA.id,
      semesterId: fixture.semester.id,
    },
  });
  await commitRevision();
  expect(
    (await request(() => findSectionDetailByJwId(a.jwId, "zh-cn", shape)))
      ?.code,
  ).toBe("UPDATED-SECTION");
  expect((await request(() => getSectionPage(a.jwId)))?.section.code).toBe(
    "UPDATED-SECTION",
  );
  expect((await request(() => findSectionDetailByJwId(missing)))?.code).toBe(
    "NEW-SECTION",
  );
});

it("teacher.public-detail-cache", async () => {
  const [a, b] = fixture.teachers;
  expect(
    (await request(() => findTeacherDetailById(a.id, "zh-cn")))?.department?.id,
  ).toBe(a.departmentId);
  expect(
    (await request(() => findTeacherDetailById(b.id, "en-us")))?.department?.id,
  ).toBe(b.departmentId);
  expect(
    (await request(() => findTeacherDetailById(a.id, "en-us")))?.namePrimary,
  ).toBe(a.nameEn);
  expect((await request(() => getTeacherPage(a.id)))?.id).toBe(a.id);
  expect(await request(() => getTeacherPage(a.id))).not.toHaveProperty("jwId");
  expect(await request(() => findTeacherDetailById(a.id))).toHaveProperty(
    "jwId",
    a.jwId,
  );
  expect(await request(() => findTeacherDetailById(a.id))).not.toHaveProperty(
    "teacher",
  );
  await db.teacher.update({
    where: { id: a.id },
    data: { nameCn: "导入更新的教师" },
  });
  expect((await request(() => findTeacherDetailById(a.id)))?.namePrimary).toBe(
    a.nameCn,
  );
  const missing = fixture.base + 99;
  expect(await request(() => findTeacherDetailById(missing))).toBeNull();
  await db.teacher.create({
    data: { id: missing, jwId: missing, nameCn: "新增教师" },
  });
  await commitRevision();
  expect((await request(() => findTeacherDetailById(a.id)))?.namePrimary).toBe(
    "导入更新的教师",
  );
  expect((await request(() => getTeacherPage(a.id)))?.namePrimary).toBe(
    "导入更新的教师",
  );
  expect(
    (await request(() => findTeacherDetailById(missing)))?.namePrimary,
  ).toBe("新增教师");
});

it("section.relational-course-filter", async () => {
  const [a, b] = fixture.courses;
  const pagination = { page: 1, pageSize: 20 };
  const match = await listSectionSummaries({
    filters: { courseId: String(a.id), courseJwId: String(a.jwId) },
    pagination,
  });
  expect(match.data.map((row) => row.id)).toEqual([fixture.sections[0].id]);
  expect(match.pagination.total).toBe(1);
  const mismatch = await listSectionSummaries({
    filters: { courseId: String(a.id), courseJwId: String(b.jwId) },
    pagination,
  });
  expect(mismatch.data).toEqual([]);
  expect(mismatch.pagination.total).toBe(0);
});

it("section.bounded-related-sections", async () => {
  const courseId = fixture.courses[0].id;
  const semesterId = (
    await db.semester.create({
      data: {
        jwId: fixture.base + 1,
        code: `${fixture.marker}-newer`,
        nameCn: "2027春",
      },
    })
  ).id;
  await db.section.create({
    data: {
      jwId: fixture.base + 29,
      code: "AAAA-OLDER",
      courseId,
      semesterId: fixture.semester.id,
    },
  });
  // Reverse insert order makes an omitted unique tie-breaker observable.
  const expected: number[] = [];
  for (let offset = 28; offset >= 2; offset--) {
    await db.section.create({
      data: {
        jwId: fixture.base + offset,
        code: "EQUAL-CODE",
        courseId,
        semesterId,
        retiredAt: offset >= 27 ? new Date() : null,
      },
    });
    if (offset < 27) expected.push(fixture.base + offset);
  }
  const result = await getSectionPage(fixture.sections[0].jwId);
  expect(result?.section.otherCourseSectionCount).toBe(26);
  expect(
    result?.section.otherCourseSections.map((section) => section.jwId),
  ).toEqual(expected.sort((a, b) => a - b).slice(0, 20));
});

it("course.public-detail-fields", async () => {
  const detail = await findCourseDetailByJwId(fixture.courses[0].jwId);
  const teachers = detail?.sections[0].teachers;
  expect(teachers).toHaveLength(1);
  expect(teachers?.[0]).toMatchObject({
    id: fixture.teachers[0].id,
    namePrimary: fixture.teachers[0].nameCn,
  });
  for (const field of [
    "email",
    "telephone",
    "mobile",
    "address",
    "age",
    "postcode",
    "qq",
    "wechat",
  ])
    expect(teachers?.[0]).not.toHaveProperty(field);
  expect(JSON.stringify(detail)).not.toContain("source-");
});

it("section.public-teacher-reference", async () => {
  const detail = await findSectionDetailByJwId(fixture.sections[0].jwId);
  expect(detail?.teachers).toHaveLength(1);
  expect(detail?.teachers[0]).toMatchObject({
    id: fixture.teachers[0].id,
    department: { id: fixture.departments[0].id },
    teacherTitle: { id: fixture.titles[0].id },
  });
  for (const field of [
    "email",
    "telephone",
    "mobile",
    "address",
    "age",
    "postcode",
    "qq",
    "wechat",
  ])
    expect(detail?.teachers[0]).not.toHaveProperty(field);
  expect(JSON.stringify(detail)).not.toContain("source-");
});

it("teacher.public-detail-fields", async () => {
  const teacher = fixture.teachers[0];
  for (const locale of ["zh-cn", "en-us"] as const) {
    const detail = await request(() =>
      findTeacherDetailById(teacher.id, locale),
    );
    expect(detail).toEqual({
      id: teacher.id,
      jwId: teacher.jwId,
      personId: teacher.personId,
      code: teacher.code,
      nameCn: teacher.nameCn,
      nameEn: teacher.nameEn,
      namePrimary: locale === "en-us" ? teacher.nameEn : teacher.nameCn,
      nameSecondary: locale === "en-us" ? teacher.nameCn : teacher.nameEn,
      email: teacher.email,
      telephone: teacher.telephone,
      mobile: teacher.mobile,
      address: teacher.address,
      departmentId: teacher.departmentId,
      teacherTitleId: teacher.teacherTitleId,
      department: expect.objectContaining({
        id: fixture.departments[0].id,
        namePrimary:
          locale === "en-us"
            ? fixture.departments[0].nameEn
            : fixture.departments[0].nameCn,
      }),
      teacherTitle: expect.objectContaining({
        id: fixture.titles[0].id,
        namePrimary:
          locale === "en-us"
            ? fixture.titles[0].nameEn
            : fixture.titles[0].nameCn,
      }),
      _count: { sections: 1 },
      sections: [
        expect.objectContaining({
          id: fixture.sections[0].id,
          jwId: fixture.sections[0].jwId,
          code: fixture.sections[0].code,
          course: expect.objectContaining({ id: fixture.courses[0].id }),
          semester: expect.objectContaining({ id: fixture.semester.id }),
        }),
      ],
    });
    for (const field of ["age", "postcode", "qq", "wechat"])
      expect(detail).not.toHaveProperty(field);
    expect(JSON.stringify(detail)).not.toContain("source-");
  }
});
