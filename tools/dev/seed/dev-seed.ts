import scenarioData from "../../../tests/e2e/fixtures/scenario.json" with {
  type: "json",
};

const s = scenarioData;

export const DEV_SEED_ANCHOR = {
  date: "2026-04-29",
  startOfDayAtTime: "2026-04-29T00:00:00+08:00",
  recommendedAtTime: "2026-04-29T08:00:00+08:00",
} as const;

export const DEV_SEED = {
  seedAnchorAtTime: DEV_SEED_ANCHOR.startOfDayAtTime,
  debugUsername: s.users.debug.username,
  debugName: s.users.debug.name,
  debugAvatarSeed: s.users.debug.avatarSeed,
  adminUsername: s.users.admin.username,
  adminName: s.users.admin.name,
  adminAvatarSeed: s.users.admin.avatarSeed,
  semesterJwId: s.semester.jwId,
  semesterNameCn: s.semester.nameCn,
  previousSemesterJwId: s.previousSemester.jwId,
  previousSemesterNameCn: s.previousSemester.nameCn,
  course: {
    jwId: s.courses[0].jwId,
    code: s.courses[0].code,
    nameCn: s.courses[0].nameCn,
    nameEn: s.courses[0].nameEn,
    educationLevelNameCn: s.catalog.educationLevel.nameCn,
    educationLevelNameEn: s.catalog.educationLevel.nameEn,
    categoryNameCn: s.catalog.category.nameCn,
    categoryNameEn: s.catalog.category.nameEn,
    classTypeNameCn: s.catalog.classType.nameCn,
    classTypeNameEn: s.catalog.classType.nameEn,
  },
  section: {
    jwId: s.sections[0].jwId,
    code: s.sections[0].code,
    credits: s.sections[0].credits,
    limitCount: s.sections[0].limitCount,
    remark: s.sections[0].remark,
    stdCount: s.sections[0].stdCount,
    examModeNameCn: s.catalog.examMode.nameCn,
    examModeNameEn: s.catalog.examMode.nameEn,
    teachLanguageNameCn: s.catalog.teachLanguage.nameCn,
    teachLanguageNameEn: s.catalog.teachLanguage.nameEn,
    roomTypeNameCn: s.catalog.roomType.nameCn,
    roomTypeNameEn: s.catalog.roomType.nameEn,
    adminClassNameCn: s.catalog.adminClass.nameCn,
    adminClassNameEn: s.catalog.adminClass.nameEn,
  },
  sections: s.sections.map((section) => ({
    jwId: section.jwId,
    code: section.code,
  })),
  teacher: {
    code: s.teachers[0].code,
    nameCn: s.teachers[0].nameCn,
    nameEn: s.teachers[0].nameEn,
    email: s.teachers[0].email,
    titleNameCn: s.catalog.teacherTitle.nameCn,
    titleNameEn: s.catalog.teacherTitle.nameEn,
    departmentNameCn: s.catalog.department.nameCn,
    departmentNameEn: s.catalog.department.nameEn,
  },
  campus: { nameCn: s.catalog.campus.nameCn, nameEn: s.catalog.campus.nameEn },
  building: {
    nameCn: s.catalog.building.nameCn,
    nameEn: s.catalog.building.nameEn,
  },
  room: { nameCn: s.catalog.room.nameCn, nameEn: s.catalog.room.nameEn },
  examBatch: {
    nameCn: s.catalog.examBatch.nameCn,
    nameEn: s.catalog.examBatch.nameEn,
  },
  metadata: {
    teachLanguageNameCn: s.catalog.teachLanguage.nameCn,
    campusNameCn: s.catalog.campus.nameCn,
    buildingNameCn: s.catalog.building.nameCn,
    courseClassifyNameCn: s.catalog.classify.nameCn,
  },
  uploads: { firstFilename: s.uploads.firstFilename },
  comments: { sectionRootBody: s.comments.sectionRootBody },
  homeworks: {
    title: s.homeworks.title,
    overdueTitle: s.homeworks.overdueTitle,
    dueTodayTitle: s.homeworks.dueTodayTitle,
    completedTitle: s.homeworks.completedTitle,
  },
  todos: {
    dueTodayTitle: s.todos.dueTodayTitle,
    overdueTitle: s.todos.overdueTitle,
    completedTitle: s.todos.completedTitle,
  },
  dashboardLinks: {
    pinnedSlugs: s.dashboardLinks.pinnedSlugs,
    overviewLimit: s.dashboardLinks.overviewLimit,
  },
  bus: {
    versionKey: s.bus.versionKey,
    versionTitle: s.bus.versionTitle,
    routeId: s.bus.routeId,
    recommendedRouteId: s.bus.recommendedRouteId,
    originCampusId: s.bus.originCampusId,
    destinationCampusId: s.bus.destinationCampusId,
    originCampusName: s.bus.originCampusName,
    destinationCampusName: s.bus.destinationCampusName,
    recommendedRoute: s.bus.recommendedRoute,
    recommendedDeparture: s.bus.recommendedDeparture,
  },
  suspensions: { reasonKeyword: s.suspensions.reasonKeyword },
} as const;

export const DEV_SCENARIO_MARKER = "[DEV-SCENARIO]";
export const DEV_SCENARIO_KEY_PREFIX = "dev-scenario/";

export const DEV_SCENARIO_IDS = {
  semesterJwId: s.semester.jwId,
  semesterJwIds: [
    s.semester.jwId,
    s.previousSemester.jwId,
  ] as readonly number[],
  courseJwIds: s.courses.map((course) => course.jwId) as readonly number[],
  sectionJwIds: s.sections.map((section) => section.jwId) as readonly number[],
  scheduleGroupJwIds: s.scheduleGroups as readonly number[],
  examJwIds: s.exams.map((exam) => exam.jwId) as readonly number[],
  teacherCodes: s.teachers.map((teacher) => teacher.code) as readonly string[],
  campusJwId: s.catalog.campus.jwId,
  roomTypeJwId: s.catalog.roomType.jwId,
  buildingJwId: s.catalog.building.jwId,
  roomJwId: s.catalog.room.jwId,
  teacherTitleJwId: s.catalog.teacherTitle.jwId,
  teacherLessonTypeJwId: s.catalog.teacherLessonType.jwId,
} as const;

const DEFAULT_DEV_DEBUG_PASSWORD = "dev-debug-password";
const DEFAULT_DEV_ADMIN_PASSWORD = "dev-admin-password";

function getTrimmedEnv(name: string) {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function getLowercaseEnv(name: string) {
  return getTrimmedEnv(name)?.toLowerCase();
}

export function getDevScenarioRuntimeConfig() {
  return {
    debugUsername:
      getLowercaseEnv("DEV_DEBUG_USERNAME") ?? DEV_SEED.debugUsername,
    debugName: getTrimmedEnv("DEV_DEBUG_NAME") ?? DEV_SEED.debugName,
    adminUsername:
      getLowercaseEnv("DEV_ADMIN_USERNAME") ?? DEV_SEED.adminUsername,
    adminName: getTrimmedEnv("DEV_ADMIN_NAME") ?? DEV_SEED.adminName,
  };
}

export function getDevDebugCredentialConfig() {
  const runtimeConfig = getDevScenarioRuntimeConfig();

  return {
    debug: {
      username: runtimeConfig.debugUsername,
      name: runtimeConfig.debugName,
      email:
        getLowercaseEnv("DEV_DEBUG_EMAIL") ??
        `${runtimeConfig.debugUsername}@debug.local`,
      password:
        getTrimmedEnv("DEV_DEBUG_PASSWORD") ?? DEFAULT_DEV_DEBUG_PASSWORD,
    },
    admin: {
      username: runtimeConfig.adminUsername,
      name: runtimeConfig.adminName,
      email:
        getLowercaseEnv("DEV_ADMIN_EMAIL") ??
        `${runtimeConfig.adminUsername}@debug.local`,
      password:
        getTrimmedEnv("DEV_ADMIN_PASSWORD") ?? DEFAULT_DEV_ADMIN_PASSWORD,
    },
  };
}
