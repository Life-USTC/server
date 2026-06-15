import scenarioData from "../../../tests/e2e/fixtures/scenario.json" with {
  type: "json",
};

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

type OpenApiExample = {
  parameters?: Record<string, unknown>;
  requestBody?: unknown;
  response?: unknown;
};

export type OpenApiExampleMap = Record<
  `${HttpMethod} ${string}`,
  OpenApiExample
>;

const s = scenarioData;
const firstCourse = s.courses[0];
const firstSection = s.sections[0];
const firstTeacher = s.teachers[0];

const ids = {
  adminClass: 101,
  building: 301,
  campus: 201,
  category: 402,
  classType: 403,
  classify: 404,
  course: 1001,
  courseType: 406,
  department: 501,
  educationLevel: 401,
  examMode: 602,
  gradation: 405,
  room: 302,
  roomType: 303,
  section: 2001,
  semester: 701,
  teachLanguage: 601,
  teacher: 8001,
  teacherTitle: 801,
} as const;

function pagination(total: number) {
  return { page: 1, pageSize: 20, total, totalPages: 1 };
}

function named(id: number, value: { nameCn: string; nameEn?: string | null }) {
  return { id, nameCn: value.nameCn, nameEn: value.nameEn ?? null };
}

function semester(value = s.semester) {
  return {
    id: ids.semester,
    jwId: value.jwId,
    nameCn: value.nameCn,
    code: value.code,
    startDate: "2026-02-23T00:00:00+08:00",
    endDate: "2026-07-05T00:00:00+08:00",
  };
}

function campus() {
  return {
    id: ids.campus,
    jwId: s.catalog.campus.jwId,
    nameCn: s.catalog.campus.nameCn,
    nameEn: s.catalog.campus.nameEn,
    code: s.catalog.campus.code,
  };
}

function department() {
  return {
    id: ids.department,
    code: s.catalog.department.code,
    nameCn: s.catalog.department.nameCn,
    nameEn: s.catalog.department.nameEn,
    isCollege: true,
  };
}

function course(value = firstCourse) {
  return {
    id: ids.course + value.index,
    jwId: value.jwId,
    code: value.code,
    nameCn: value.nameCn,
    nameEn: value.nameEn,
    categoryId: ids.category,
    classTypeId: ids.classType,
    classifyId: ids.classify,
    educationLevelId: ids.educationLevel,
    gradationId: ids.gradation,
    typeId: ids.courseType,
    category: named(ids.category, s.catalog.category),
    classType: named(ids.classType, s.catalog.classType),
    classify: named(ids.classify, s.catalog.classify),
    educationLevel: named(ids.educationLevel, s.catalog.educationLevel),
    gradation: named(ids.gradation, s.catalog.gradation),
    type: named(ids.courseType, s.catalog.courseType),
  };
}

function teacher(value = firstTeacher) {
  return {
    id: ids.teacher + value.index,
    personId: null,
    teacherId: null,
    code: value.code,
    nameCn: value.nameCn,
    nameEn: value.nameEn,
    age: null,
    email: value.email,
    telephone: null,
    mobile: value.mobile,
    address: null,
    postcode: null,
    qq: null,
    wechat: null,
    departmentId: ids.department,
    teacherTitleId: ids.teacherTitle,
  };
}

function teacherWithRelations(value = firstTeacher) {
  return {
    ...teacher(value),
    department: department(),
    teacherTitle: {
      id: ids.teacherTitle,
      jwId: s.catalog.teacherTitle.jwId,
      code: s.catalog.teacherTitle.code,
      nameCn: s.catalog.teacherTitle.nameCn,
      nameEn: s.catalog.teacherTitle.nameEn,
      enabled: true,
    },
  };
}

function sectionBase(value = firstSection) {
  return {
    id: ids.section + value.index,
    jwId: value.jwId,
    code: value.code,
    bizTypeId: null,
    credits: value.credits,
    period: 48,
    periodsPerWeek: 4,
    timesPerWeek: 2,
    stdCount: value.stdCount,
    limitCount: value.limitCount,
    graduateAndPostgraduate: false,
    dateTimePlaceText: "周一 3-4节, 一教101",
    dateTimePlacePersonText: null,
    actualPeriods: 48,
    theoryPeriods: 32,
    practicePeriods: 16,
    experimentPeriods: null,
    machinePeriods: null,
    designPeriods: null,
    testPeriods: null,
    scheduleState: "scheduled",
    suggestScheduleWeeks: null,
    suggestScheduleWeekInfo: "1-16周",
    scheduleJsonParams: null,
    selectedStdCount: value.stdCount,
    remark: value.remark,
    scheduleRemark: null,
    courseId: ids.course + value.index,
    semesterId: ids.semester,
    campusId: ids.campus,
    examModeId: ids.examMode,
    openDepartmentId: ids.department,
    teachLanguageId: ids.teachLanguage,
    roomTypeId: ids.roomType,
  };
}

function sectionSummary(value = firstSection) {
  return {
    id: ids.section + value.index,
    jwId: value.jwId,
    code: value.code,
    credits: value.credits,
    stdCount: value.stdCount,
    limitCount: value.limitCount,
    courseId: ids.course + value.index,
    semesterId: ids.semester,
    campusId: ids.campus,
    openDepartmentId: ids.department,
    course: {
      id: ids.course + value.index,
      jwId: s.courses[value.index]?.jwId ?? firstCourse.jwId,
      code: s.courses[value.index]?.code ?? firstCourse.code,
      nameCn: s.courses[value.index]?.nameCn ?? firstCourse.nameCn,
      nameEn: s.courses[value.index]?.nameEn ?? firstCourse.nameEn,
    },
    semester: semester(),
    campus: campus(),
    teachers: value.teacherIndexes.map((teacherIndex) => {
      const t = s.teachers[teacherIndex] ?? firstTeacher;
      return {
        id: ids.teacher + t.index,
        personId: null,
        teacherId: null,
        code: t.code,
        nameCn: t.nameCn,
        nameEn: t.nameEn,
      };
    }),
  };
}

function sectionCompact(value = firstSection) {
  return {
    ...sectionBase(value),
    course: course(s.courses[value.index] ?? firstCourse),
    semester: semester(),
    campus: campus(),
    openDepartment: department(),
    teachers: value.teacherIndexes.map((index) =>
      teacher(s.teachers[index] ?? firstTeacher),
    ),
  };
}

function courseDetailSection(value = firstSection) {
  return {
    ...sectionBase(value),
    semester: semester(),
    campus: campus(),
    teachers: value.teacherIndexes.map((index) =>
      teacher(s.teachers[index] ?? firstTeacher),
    ),
  };
}

function teacherDetailSection(value = firstSection) {
  return {
    ...sectionBase(value),
    course: course(s.courses[value.index] ?? firstCourse),
    semester: semester(),
  };
}

function sectionDetail() {
  return {
    ...sectionBase(),
    course: course(),
    semester: semester(),
    campus: campus(),
    openDepartment: department(),
    examMode: named(ids.examMode, s.catalog.examMode),
    teachLanguage: named(ids.teachLanguage, s.catalog.teachLanguage),
    roomType: {
      id: ids.roomType,
      jwId: s.catalog.roomType.jwId,
      code: s.catalog.roomType.code,
      nameCn: s.catalog.roomType.nameCn,
      nameEn: s.catalog.roomType.nameEn,
    },
    schedules: [],
    scheduleGroups: [],
    teachers: firstSection.teacherIndexes.map((index) =>
      teacherWithRelations(s.teachers[index] ?? firstTeacher),
    ),
    teacherAssignments: [],
    exams: [],
    adminClasses: [
      {
        id: ids.adminClass,
        jwId: s.catalog.adminClass.jwId,
        code: s.catalog.adminClass.code,
        grade: "2022",
        nameCn: s.catalog.adminClass.nameCn,
        nameEn: s.catalog.adminClass.nameEn,
        stdCount: 58,
        planCount: 60,
        enabled: true,
        abbrZh: "计01",
        abbrEn: "CS01",
      },
    ],
  };
}

function metadata() {
  return {
    educationLevels: [named(ids.educationLevel, s.catalog.educationLevel)],
    courseCategories: [named(ids.category, s.catalog.category)],
    courseClassifies: [named(ids.classify, s.catalog.classify)],
    classTypes: [named(ids.classType, s.catalog.classType)],
    courseTypes: [named(ids.courseType, s.catalog.courseType)],
    courseGradations: [named(ids.gradation, s.catalog.gradation)],
    examModes: [named(ids.examMode, s.catalog.examMode)],
    teachLanguages: [named(ids.teachLanguage, s.catalog.teachLanguage)],
    campuses: [
      {
        ...campus(),
        buildings: [
          {
            id: ids.building,
            jwId: s.catalog.building.jwId,
            code: s.catalog.building.code,
            nameCn: s.catalog.building.nameCn,
            nameEn: s.catalog.building.nameEn,
            campusId: ids.campus,
          },
        ],
      },
    ],
  };
}

export function buildScenarioOpenApiExamples(): OpenApiExampleMap {
  return {
    "GET /api/sections": {
      parameters: {
        semesterJwId: s.semester.jwId,
        teacherCode: firstTeacher.code,
        search: firstCourse.code,
        page: 1,
        limit: 20,
      },
      response: {
        data: s.sections.slice(0, 2).map(sectionSummary),
        pagination: pagination(s.sections.length),
      },
    },
    "GET /api/sections/{jwId}": {
      parameters: { jwId: firstSection.jwId },
      response: sectionDetail(),
    },
    "POST /api/sections/match-codes": {
      requestBody: {
        codes: s.sections.slice(0, 2).map((section) => section.code),
      },
      response: {
        semester: {
          id: ids.semester,
          nameCn: s.semester.nameCn,
          code: s.semester.code,
        },
        matchedCodes: s.sections.slice(0, 2).map((section) => section.code),
        unmatchedCodes: [],
        sections: s.sections.slice(0, 2).map(sectionCompact),
        total: 2,
      },
    },
    "GET /api/courses": {
      parameters: { search: firstCourse.code, page: 1, limit: 20 },
      response: {
        data: s.courses.slice(0, 2).map(course),
        pagination: pagination(s.courses.length),
      },
    },
    "GET /api/courses/{jwId}": {
      parameters: { jwId: firstCourse.jwId },
      response: { ...course(), sections: [courseDetailSection()] },
    },
    "GET /api/teachers": {
      parameters: { search: firstTeacher.nameCn, page: 1, limit: 20 },
      response: {
        data: s.teachers.slice(0, 2).map((value) => ({
          ...teacherWithRelations(value),
          _count: { sections: 1 },
        })),
        pagination: pagination(s.teachers.length),
      },
    },
    "GET /api/teachers/{id}": {
      parameters: { id: ids.teacher },
      response: {
        ...teacherWithRelations(),
        sections: [teacherDetailSection()],
        _count: { sections: 1 },
      },
    },
    "GET /api/semesters": {
      parameters: { page: 1, limit: 20 },
      response: {
        data: [semester(), semester(s.previousSemester)],
        pagination: pagination(2),
      },
    },
    "GET /api/semesters/current": {
      response: semester(),
    },
    "GET /api/metadata": {
      response: metadata(),
    },
  };
}
