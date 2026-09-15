import { beforeEach, describe, expect, it, vi } from "vitest";
import { sectionDetailSchema } from "@/lib/api/schemas/academic-section-detail-response-schemas";
import { resetPublicRuntimeCacheForTest } from "@/lib/public-runtime-cache";

const { sectionFindUniqueMock } = vi.hoisted(() => ({
  sectionFindUniqueMock: vi.fn(),
}));

vi.mock("@/lib/catalog-detail-cache-revision", () => ({
  getCatalogDetailCacheRevision: vi.fn(async () => "test-revision"),
}));

vi.mock("@/lib/db/prisma", () => ({
  getPrisma: vi.fn(() => ({
    section: { findUnique: sectionFindUniqueMock },
  })),
}));

const course = {
  id: 11,
  jwId: 1011,
  code: "COURSE-11",
  nameCn: "测试课程",
  nameEn: "Test Course",
  categoryId: null,
  classTypeId: null,
  classifyId: null,
  educationLevelId: null,
  gradationId: null,
  typeId: null,
  category: null,
  classType: null,
  classify: null,
  educationLevel: null,
  gradation: null,
  type: null,
};

const schedule = {
  id: 21,
  periods: 2,
  date: null,
  weekday: 1,
  startTime: 750,
  endTime: 925,
  experiment: null,
  customPlace: null,
  lessonType: null,
  weekIndex: 1,
  exerciseClass: null,
  startUnit: 1,
  endUnit: 2,
  roomId: null,
  sectionId: 1,
  scheduleGroupId: 31,
};

const scheduleGroup = {
  id: 31,
  jwId: 1031,
  no: 1,
  limitCount: 40,
  stdCount: 30,
  actualPeriods: 2,
  isDefault: true,
  sectionId: 1,
};

const exam = {
  id: 41,
  jwId: 1041,
  examType: 1,
  startTime: 900,
  endTime: 1100,
  examDate: new Date("2026-08-17T00:00:00.000Z"),
  examTakeCount: 30,
  examMode: "闭卷",
  examBatchId: null,
  sectionId: 1,
  examBatch: null,
  examRooms: [],
};

const teacherAssignment = {
  id: 51,
  teacherId: 61,
  sectionId: 1,
  role: null,
  period: 32,
  weekIndices: [1, 2],
  weekIndicesMsg: "1-2",
  teacherLessonTypeId: null,
  teacherTitleId: null,
  teacherLessonType: null,
  teacherTitle: null,
};

const sectionBase = {
  id: 1,
  jwId: 1001,
  retiredAt: null,
  code: "COURSE-11.01",
  bizTypeId: null,
  credits: 2,
  period: 32,
  periodsPerWeek: 2,
  timesPerWeek: 1,
  stdCount: 30,
  limitCount: 40,
  graduateAndPostgraduate: null,
  dateTimePlaceText: null,
  dateTimePlacePersonText: null,
  actualPeriods: 32,
  theoryPeriods: 32,
  practicePeriods: 0,
  experimentPeriods: 0,
  machinePeriods: 0,
  designPeriods: 0,
  testPeriods: 0,
  scheduleState: null,
  suggestScheduleWeeks: null,
  suggestScheduleWeekInfo: null,
  scheduleJsonParams: null,
  selectedStdCount: 30,
  remark: null,
  scheduleRemark: null,
  courseId: course.id,
  semesterId: null,
  campusId: null,
  examModeId: null,
  openDepartmentId: null,
  teachLanguageId: null,
  roomTypeId: null,
  course,
  semester: null,
  campus: null,
  openDepartment: null,
  examMode: null,
  teachLanguage: null,
  roomType: null,
  teachers: [],
  adminClasses: [],
};

describe("partial section detail query", () => {
  beforeEach(() => {
    resetPublicRuntimeCacheForTest();
    sectionFindUniqueMock.mockReset();
    sectionFindUniqueMock.mockImplementation(async ({ include }) => ({
      ...sectionBase,
      exams: include.exams.take === 0 ? [] : [exam],
      schedules: include.schedules.take === 0 ? [] : [schedule],
      scheduleGroups: include.scheduleGroups.take === 0 ? [] : [scheduleGroup],
      teacherAssignments:
        include.teacherAssignments.take === 0 ? [] : [teacherAssignment],
    }));
  });

  it.each([
    {
      name: "exams",
      options: { includeExams: true },
      expected: {
        exams: [exam.id],
        schedules: [],
        groups: [],
        assignments: [],
      },
    },
    {
      name: "schedules",
      options: { includeSchedules: true },
      expected: {
        exams: [],
        schedules: [schedule.id],
        groups: [scheduleGroup.id],
        assignments: [],
      },
    },
    {
      name: "teacher departments",
      options: { includeTeacherDepartments: true },
      expected: {
        exams: [],
        schedules: [],
        groups: [],
        assignments: [teacherAssignment.id],
      },
    },
    {
      name: "all requested relations",
      options: {
        includeExams: true,
        includeSchedules: true,
        includeTeacherDepartments: true,
      },
      expected: {
        exams: [exam.id],
        schedules: [schedule.id],
        groups: [scheduleGroup.id],
        assignments: [teacherAssignment.id],
      },
    },
  ])(
    "maps $name through the strict section detail DTO",
    async ({ options, expected }) => {
      const { findSectionDetailByJwId } = await import(
        "@/features/catalog/server/course-section-read-queries"
      );

      const result = await findSectionDetailByJwId(
        sectionBase.jwId,
        "zh-cn",
        options,
      );

      expect(() => sectionDetailSchema.parse(result)).not.toThrow();
      expect(result).toMatchObject({
        exams: expected.exams.map((id) => ({ id })),
        schedules: expected.schedules.map((id) => ({ id })),
        scheduleGroups: expected.groups.map((id) => ({ id })),
        teacherAssignments: expected.assignments.map((id) => ({ id })),
      });
      if (expected.schedules.length > 0) {
        expect(result?.schedules[0]).toMatchObject({
          startTime: "07:50",
          endTime: "09:25",
        });
      }

      const include = sectionFindUniqueMock.mock.calls[0]?.[0].include;
      expect(include.exams.take !== 0).toBe(options.includeExams === true);
      expect(include.schedules.take !== 0).toBe(
        options.includeSchedules === true,
      );
      expect(include.scheduleGroups.take !== 0).toBe(
        options.includeSchedules === true,
      );
      expect(include.teacherAssignments.take !== 0).toBe(
        options.includeTeacherDepartments === true,
      );
    },
  );
});
