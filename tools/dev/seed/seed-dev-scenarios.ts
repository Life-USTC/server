import { importBusStaticPayload } from "../../../src/features/bus/lib/bus-import";
import type { BusStaticPayload } from "../../../src/features/bus/lib/bus-types";
import {
  CommentReactionType,
  CommentStatus,
  CommentVisibility,
  HomeworkAuditAction,
  type Prisma,
} from "../../../src/generated/prisma/client";
import scenarioData from "../../../tests/e2e/fixtures/scenario.json" with {
  type: "json",
};
import {
  createToolPrisma,
  disconnectToolPrisma,
} from "../../shared/tool-prisma";
import { cleanupDevScenarioData } from "./dev-scenario-cleanup";
import {
  DEV_SCENARIO_IDS,
  DEV_SCENARIO_KEY_PREFIX,
  DEV_SCENARIO_MARKER,
  DEV_SEED,
  getDevScenarioRuntimeConfig,
} from "./dev-seed";

const prisma = createToolPrisma();
const scenario = scenarioData;

const { debugUsername, debugName, adminUsername, adminName } =
  getDevScenarioRuntimeConfig();

const SEMESTER_JW_ID = DEV_SCENARIO_IDS.semesterJwId;
const COURSE_JW_IDS = DEV_SCENARIO_IDS.courseJwIds;
const SECTION_JW_IDS = DEV_SCENARIO_IDS.sectionJwIds;
const SCHEDULE_GROUP_JW_IDS = DEV_SCENARIO_IDS.scheduleGroupJwIds;
const EXAM_JW_IDS = DEV_SCENARIO_IDS.examJwIds;
const TEACHER_CODES = DEV_SCENARIO_IDS.teacherCodes;
const DEV_CAMPUS_JW_ID = DEV_SCENARIO_IDS.campusJwId;
const DEV_ROOM_TYPE_JW_ID = DEV_SCENARIO_IDS.roomTypeJwId;
const DEV_BUILDING_JW_ID = DEV_SCENARIO_IDS.buildingJwId;
const DEV_ROOM_JW_ID = DEV_SCENARIO_IDS.roomJwId;
const DEV_TEACHER_TITLE_JW_ID = DEV_SCENARIO_IDS.teacherTitleJwId;
const DEV_TEACHER_LESSON_TYPE_JW_ID = DEV_SCENARIO_IDS.teacherLessonTypeJwId;
const DEV_BUS_PAYLOAD: BusStaticPayload = {
  campuses: [
    { id: 1, name: "东区", latitude: 117.268264, longitude: 31.83892 },
    { id: 2, name: "西区", latitude: 117.256645, longitude: 31.839258 },
    { id: 3, name: "北区", latitude: 117.268125, longitude: 31.841933 },
    { id: 4, name: "南区", latitude: 117.283853, longitude: 31.822112 },
    { id: 5, name: "先研院", latitude: 117.129257, longitude: 31.826345 },
    { id: 6, name: "高新", latitude: 117.129369, longitude: 31.820447 },
  ],
  routes: [
    {
      id: 1,
      campuses: [
        { id: 1, name: "东区", latitude: 117.268264, longitude: 31.83892 },
        { id: 3, name: "北区", latitude: 117.268125, longitude: 31.841933 },
        { id: 2, name: "西区", latitude: 117.256645, longitude: 31.839258 },
      ],
    },
    {
      id: 3,
      campuses: [
        { id: 1, name: "东区", latitude: 117.268264, longitude: 31.83892 },
        { id: 4, name: "南区", latitude: 117.283853, longitude: 31.822112 },
      ],
    },
    {
      id: 7,
      campuses: [
        { id: 6, name: "高新", latitude: 117.129369, longitude: 31.820447 },
        { id: 5, name: "先研院", latitude: 117.129257, longitude: 31.826345 },
        { id: 2, name: "西区", latitude: 117.256645, longitude: 31.839258 },
        { id: 1, name: "东区", latitude: 117.268264, longitude: 31.83892 },
      ],
    },
    {
      id: 8,
      campuses: [
        { id: 1, name: "东区", latitude: 117.268264, longitude: 31.83892 },
        { id: 2, name: "西区", latitude: 117.256645, longitude: 31.839258 },
        { id: 5, name: "先研院", latitude: 117.129257, longitude: 31.826345 },
        { id: 6, name: "高新", latitude: 117.129369, longitude: 31.820447 },
      ],
    },
  ],
  weekday_routes: [
    {
      id: 1,
      route: {
        id: 1,
        campuses: [
          { id: 1, name: "东区", latitude: 117.268264, longitude: 31.83892 },
          { id: 3, name: "北区", latitude: 117.268125, longitude: 31.841933 },
          { id: 2, name: "西区", latitude: 117.256645, longitude: 31.839258 },
        ],
      },
      time: [
        ["07:30", null, "07:40"],
        ["09:20", null, "09:30"],
        ["18:40", null, "18:50"],
        ["21:15", null, "21:25"],
      ],
    },
    {
      id: 3,
      route: {
        id: 3,
        campuses: [
          { id: 1, name: "东区", latitude: 117.268264, longitude: 31.83892 },
          { id: 4, name: "南区", latitude: 117.283853, longitude: 31.822112 },
        ],
      },
      time: [
        ["08:30", "08:45"],
        ["12:35", "12:50"],
        ["17:45", "18:00"],
      ],
    },
    {
      id: 7,
      route: {
        id: 7,
        campuses: [
          { id: 6, name: "高新", latitude: 117.129369, longitude: 31.820447 },
          { id: 5, name: "先研院", latitude: 117.129257, longitude: 31.826345 },
          { id: 2, name: "西区", latitude: 117.256645, longitude: 31.839258 },
          { id: 1, name: "东区", latitude: 117.268264, longitude: 31.83892 },
        ],
      },
      time: [
        ["08:00", "08:05", null, "08:50"],
        ["14:30", "14:35", null, "15:25"],
        ["18:30", "18:35", null, "19:25"],
      ],
    },
    {
      id: 8,
      route: {
        id: 8,
        campuses: [
          { id: 1, name: "东区", latitude: 117.268264, longitude: 31.83892 },
          { id: 2, name: "西区", latitude: 117.256645, longitude: 31.839258 },
          { id: 5, name: "先研院", latitude: 117.129257, longitude: 31.826345 },
          { id: 6, name: "高新", latitude: 117.129369, longitude: 31.820447 },
        ],
      },
      time: [
        ["06:50", "07:00", null, "07:40"],
        ["12:50", "13:00", null, "13:40"],
        ["21:20", "21:30", null, "22:00"],
      ],
    },
  ],
  weekend_routes: [
    {
      id: 1,
      route: {
        id: 1,
        campuses: [
          { id: 1, name: "东区", latitude: 117.268264, longitude: 31.83892 },
          { id: 3, name: "北区", latitude: 117.268125, longitude: 31.841933 },
          { id: 2, name: "西区", latitude: 117.256645, longitude: 31.839258 },
        ],
      },
      time: [
        ["07:30", null, "07:40"],
        ["17:30", null, "17:40"],
        ["21:15", null, "21:25"],
      ],
    },
    {
      id: 3,
      route: {
        id: 3,
        campuses: [
          { id: 1, name: "东区", latitude: 117.268264, longitude: 31.83892 },
          { id: 4, name: "南区", latitude: 117.283853, longitude: 31.822112 },
        ],
      },
      time: [
        ["11:45", "12:00"],
        ["19:00", "19:15"],
      ],
    },
    {
      id: 7,
      route: {
        id: 7,
        campuses: [
          { id: 6, name: "高新", latitude: 117.129369, longitude: 31.820447 },
          { id: 5, name: "先研院", latitude: 117.129257, longitude: 31.826345 },
          { id: 2, name: "西区", latitude: 117.256645, longitude: 31.839258 },
          { id: 1, name: "东区", latitude: 117.268264, longitude: 31.83892 },
        ],
      },
      time: [
        ["08:00", "08:05", null, "08:50"],
        ["21:50", "21:55", null, "22:40"],
      ],
    },
    {
      id: 8,
      route: {
        id: 8,
        campuses: [
          { id: 1, name: "东区", latitude: 117.268264, longitude: 31.83892 },
          { id: 2, name: "西区", latitude: 117.256645, longitude: 31.839258 },
          { id: 5, name: "先研院", latitude: 117.129257, longitude: 31.826345 },
          { id: 6, name: "高新", latitude: 117.129369, longitude: 31.820447 },
        ],
      },
      time: [
        ["07:00", "07:10", null, "07:50"],
        ["18:30", "18:40", null, "19:30"],
      ],
    },
  ],
  message: {
    message: "校车运营数据仅供测试使用。",
    url: "https://github.com/Life-USTC/static",
  },
};

type DevBusSeed = {
  payload: BusStaticPayload;
  versionTitle: string;
  effectiveFrom: Date | null;
  effectiveUntil: Date | null;
};

const SEED_ANCHOR_DATE = new Date(2026, 3, 29, 0, 0, 0, 0);

function makeDateAt(hour: number, minute: number, offsetDays = 0) {
  return new Date(
    SEED_ANCHOR_DATE.getFullYear(),
    SEED_ANCHOR_DATE.getMonth(),
    SEED_ANCHOR_DATE.getDate() + offsetDays,
    hour,
    minute,
    0,
    0,
  );
}

function toWeekday(date: Date) {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

async function resolveDevBusSeed(): Promise<DevBusSeed> {
  return {
    payload: DEV_BUS_PAYLOAD,
    versionTitle: DEV_SEED.bus.versionTitle,
    effectiveFrom: makeDateAt(0, 0, -7),
    effectiveUntil: null,
  };
}

async function main() {
  const debugUserData = {
    email: `${debugUsername}@users.local`,
    emailVerified: true,
    name: debugName,
    image: `https://api.dicebear.com/9.x/shapes/svg?seed=${DEV_SEED.debugAvatarSeed}`,
  };
  const adminUserData = {
    email: `${adminUsername}@users.local`,
    emailVerified: true,
    name: adminName,
    isAdmin: true,
    image: `https://api.dicebear.com/9.x/shapes/svg?seed=${DEV_SEED.adminAvatarSeed}`,
  };
  const [debugUser, adminUser] = await Promise.all([
    prisma.user.upsert({
      where: { username: debugUsername },
      update: debugUserData,
      create: { username: debugUsername, ...debugUserData },
      select: { id: true, username: true },
    }),
    prisma.user.upsert({
      where: { username: adminUsername },
      update: adminUserData,
      create: { username: adminUsername, ...adminUserData },
      select: { id: true, username: true },
    }),
  ]);
  const busSeed = await resolveDevBusSeed();

  await cleanupDevScenarioData(prisma, [debugUser.id, adminUser.id], {
    userSuspensions: "byUser",
  });

  const [
    seedCampus,
    seedDepartment,
    seedRoomType,
    seedTeachLanguage,
    seedExamMode,
    seedEducationLevel,
    seedCategory,
    seedClassType,
    seedClassify,
    seedGradation,
    seedCourseType,
    seedTeacherTitle,
    seedTeacherLessonType,
    seedAdminClass,
    seedExamBatch,
  ] = await Promise.all([
    prisma.campus.upsert({
      where: { jwId: DEV_CAMPUS_JW_ID },
      update: {
        code: scenario.catalog.campus.code,
        nameCn: DEV_SEED.campus.nameCn,
        nameEn: DEV_SEED.campus.nameEn,
      },
      create: {
        jwId: DEV_CAMPUS_JW_ID,
        code: scenario.catalog.campus.code,
        nameCn: DEV_SEED.campus.nameCn,
        nameEn: DEV_SEED.campus.nameEn,
      },
      select: { id: true },
    }),
    prisma.department.upsert({
      where: { code: scenario.catalog.department.code },
      update: {
        nameCn: DEV_SEED.teacher.departmentNameCn,
        nameEn: DEV_SEED.teacher.departmentNameEn,
        isCollege: true,
      },
      create: {
        code: scenario.catalog.department.code,
        nameCn: DEV_SEED.teacher.departmentNameCn,
        nameEn: DEV_SEED.teacher.departmentNameEn,
        isCollege: true,
      },
      select: { id: true },
    }),
    prisma.roomType.upsert({
      where: { jwId: DEV_ROOM_TYPE_JW_ID },
      update: {
        code: scenario.catalog.roomType.code,
        nameCn: DEV_SEED.section.roomTypeNameCn,
        nameEn: DEV_SEED.section.roomTypeNameEn,
      },
      create: {
        jwId: DEV_ROOM_TYPE_JW_ID,
        code: scenario.catalog.roomType.code,
        nameCn: DEV_SEED.section.roomTypeNameCn,
        nameEn: DEV_SEED.section.roomTypeNameEn,
      },
      select: { id: true },
    }),
    prisma.teachLanguage.upsert({
      where: { nameCn: DEV_SEED.section.teachLanguageNameCn },
      update: { nameEn: DEV_SEED.section.teachLanguageNameEn },
      create: {
        nameCn: DEV_SEED.section.teachLanguageNameCn,
        nameEn: DEV_SEED.section.teachLanguageNameEn,
      },
      select: { id: true },
    }),
    prisma.examMode.upsert({
      where: { nameCn: DEV_SEED.section.examModeNameCn },
      update: { nameEn: DEV_SEED.section.examModeNameEn },
      create: {
        nameCn: DEV_SEED.section.examModeNameCn,
        nameEn: DEV_SEED.section.examModeNameEn,
      },
      select: { id: true },
    }),
    prisma.educationLevel.upsert({
      where: { nameCn: DEV_SEED.course.educationLevelNameCn },
      update: { nameEn: DEV_SEED.course.educationLevelNameEn },
      create: {
        nameCn: DEV_SEED.course.educationLevelNameCn,
        nameEn: DEV_SEED.course.educationLevelNameEn,
      },
      select: { id: true },
    }),
    prisma.courseCategory.upsert({
      where: { nameCn: DEV_SEED.course.categoryNameCn },
      update: { nameEn: DEV_SEED.course.categoryNameEn },
      create: {
        nameCn: DEV_SEED.course.categoryNameCn,
        nameEn: DEV_SEED.course.categoryNameEn,
      },
      select: { id: true },
    }),
    prisma.classType.upsert({
      where: { nameCn: DEV_SEED.course.classTypeNameCn },
      update: { nameEn: DEV_SEED.course.classTypeNameEn },
      create: {
        nameCn: DEV_SEED.course.classTypeNameCn,
        nameEn: DEV_SEED.course.classTypeNameEn,
      },
      select: { id: true },
    }),
    prisma.courseClassify.upsert({
      where: { nameCn: scenario.catalog.classify.nameCn },
      update: { nameEn: scenario.catalog.classify.nameEn },
      create: {
        nameCn: scenario.catalog.classify.nameCn,
        nameEn: scenario.catalog.classify.nameEn,
      },
      select: { id: true },
    }),
    prisma.courseGradation.upsert({
      where: { nameCn: scenario.catalog.gradation.nameCn },
      update: { nameEn: scenario.catalog.gradation.nameEn },
      create: {
        nameCn: scenario.catalog.gradation.nameCn,
        nameEn: scenario.catalog.gradation.nameEn,
      },
      select: { id: true },
    }),
    prisma.courseType.upsert({
      where: { nameCn: scenario.catalog.courseType.nameCn },
      update: { nameEn: scenario.catalog.courseType.nameEn },
      create: {
        nameCn: scenario.catalog.courseType.nameCn,
        nameEn: scenario.catalog.courseType.nameEn,
      },
      select: { id: true },
    }),
    prisma.teacherTitle.upsert({
      where: { jwId: DEV_TEACHER_TITLE_JW_ID },
      update: {
        code: scenario.catalog.teacherTitle.code,
        nameCn: DEV_SEED.teacher.titleNameCn,
        nameEn: DEV_SEED.teacher.titleNameEn,
        enabled: true,
      },
      create: {
        jwId: DEV_TEACHER_TITLE_JW_ID,
        code: scenario.catalog.teacherTitle.code,
        nameCn: DEV_SEED.teacher.titleNameCn,
        nameEn: DEV_SEED.teacher.titleNameEn,
        enabled: true,
      },
      select: { id: true },
    }),
    prisma.teacherLessonType.upsert({
      where: { jwId: DEV_TEACHER_LESSON_TYPE_JW_ID },
      update: {
        code: scenario.catalog.teacherLessonType.code,
        nameCn: scenario.catalog.teacherLessonType.nameCn,
        nameEn: scenario.catalog.teacherLessonType.nameEn,
        role: "lecturer",
        enabled: true,
      },
      create: {
        jwId: DEV_TEACHER_LESSON_TYPE_JW_ID,
        code: scenario.catalog.teacherLessonType.code,
        nameCn: scenario.catalog.teacherLessonType.nameCn,
        nameEn: scenario.catalog.teacherLessonType.nameEn,
        role: "lecturer",
        enabled: true,
      },
      select: { id: true },
    }),
    prisma.adminClass.upsert({
      where: { nameCn: DEV_SEED.section.adminClassNameCn },
      update: {
        jwId: scenario.catalog.adminClass.jwId,
        code: scenario.catalog.adminClass.code,
        nameEn: DEV_SEED.section.adminClassNameEn,
      },
      create: {
        jwId: scenario.catalog.adminClass.jwId,
        code: scenario.catalog.adminClass.code,
        nameCn: DEV_SEED.section.adminClassNameCn,
        nameEn: DEV_SEED.section.adminClassNameEn,
        grade: "2026",
        stdCount: 32,
        planCount: 35,
        enabled: true,
      },
      select: { id: true },
    }),
    prisma.examBatch.upsert({
      where: { nameCn: DEV_SEED.examBatch.nameCn },
      update: { nameEn: DEV_SEED.examBatch.nameEn },
      create: {
        nameCn: DEV_SEED.examBatch.nameCn,
        nameEn: DEV_SEED.examBatch.nameEn,
      },
      select: { id: true },
    }),
  ]);

  const seedBuilding = await prisma.building.upsert({
    where: { jwId: DEV_BUILDING_JW_ID },
    update: {
      nameCn: DEV_SEED.building.nameCn,
      nameEn: DEV_SEED.building.nameEn,
      code: scenario.catalog.building.code,
      campusId: seedCampus.id,
    },
    create: {
      jwId: DEV_BUILDING_JW_ID,
      nameCn: DEV_SEED.building.nameCn,
      nameEn: DEV_SEED.building.nameEn,
      code: scenario.catalog.building.code,
      campusId: seedCampus.id,
    },
    select: { id: true },
  });

  await prisma.room.upsert({
    where: { jwId: DEV_ROOM_JW_ID },
    update: {
      nameCn: DEV_SEED.room.nameCn,
      nameEn: DEV_SEED.room.nameEn,
      code: "101",
      virtual: false,
      seatsForSection: 60,
      seats: 60,
      buildingId: seedBuilding.id,
      roomTypeId: seedRoomType.id,
    },
    create: {
      jwId: DEV_ROOM_JW_ID,
      nameCn: DEV_SEED.room.nameCn,
      nameEn: DEV_SEED.room.nameEn,
      code: "101",
      floor: 1,
      virtual: false,
      seatsForSection: 60,
      seats: 60,
      buildingId: seedBuilding.id,
      roomTypeId: seedRoomType.id,
    },
  });

  const semesterStart = makeDateAt(0, 0, -21);
  const semesterEnd = makeDateAt(0, 0, 130);
  const previousSemesterStart = makeDateAt(0, 0, -190);
  const previousSemesterEnd = makeDateAt(0, 0, -30);

  const [rooms, semester, previousSemester] = await Promise.all([
    prisma.room.findMany({
      select: { id: true, nameCn: true },
      take: 8,
      orderBy: { id: "asc" },
    }),
    prisma.semester.upsert({
      where: { jwId: SEMESTER_JW_ID },
      update: {
        nameCn: DEV_SEED.semesterNameCn,
        code: scenario.semester.code,
        startDate: semesterStart,
        endDate: semesterEnd,
      },
      create: {
        jwId: SEMESTER_JW_ID,
        nameCn: DEV_SEED.semesterNameCn,
        code: scenario.semester.code,
        startDate: semesterStart,
        endDate: semesterEnd,
      },
      select: { id: true },
    }),
    prisma.semester.upsert({
      where: { jwId: DEV_SEED.previousSemesterJwId },
      update: {
        nameCn: DEV_SEED.previousSemesterNameCn,
        code: scenario.previousSemester.code,
        startDate: previousSemesterStart,
        endDate: previousSemesterEnd,
      },
      create: {
        jwId: DEV_SEED.previousSemesterJwId,
        nameCn: DEV_SEED.previousSemesterNameCn,
        code: scenario.previousSemester.code,
        startDate: previousSemesterStart,
        endDate: previousSemesterEnd,
      },
      select: { id: true },
    }),
  ]);

  const teachers = await Promise.all(
    [
      {
        code: TEACHER_CODES[0],
        nameCn: scenario.teachers[0].nameCn,
        nameEn: scenario.teachers[0].nameEn,
        email: scenario.teachers[0].email,
        mobile: "13800001111",
      },
      {
        code: TEACHER_CODES[1],
        nameCn: scenario.teachers[1].nameCn,
        nameEn: scenario.teachers[1].nameEn,
        email: scenario.teachers[1].email,
        mobile: "13800002222",
      },
      {
        code: TEACHER_CODES[2],
        nameCn: scenario.teachers[2].nameCn,
        nameEn: scenario.teachers[2].nameEn,
        email: scenario.teachers[2].email,
        mobile: "13800003333",
      },
    ].map((teacherSeed) =>
      prisma.teacher.upsert({
        where: { code: teacherSeed.code },
        update: {
          ...teacherSeed,
          departmentId: seedDepartment.id,
          teacherTitleId: seedTeacherTitle.id,
          address: "中国科学技术大学",
        },
        create: {
          ...teacherSeed,
          departmentId: seedDepartment.id,
          teacherTitleId: seedTeacherTitle.id,
          address: "中国科学技术大学",
        },
        select: { id: true, nameCn: true },
      }),
    ),
  );

  const courses = await Promise.all(
    [
      {
        jwId: COURSE_JW_IDS[0],
        code: scenario.courses[0].code,
        nameCn: scenario.courses[0].nameCn,
        nameEn: scenario.courses[0].nameEn,
      },
      {
        jwId: COURSE_JW_IDS[1],
        code: scenario.courses[1].code,
        nameCn: scenario.courses[1].nameCn,
        nameEn: scenario.courses[1].nameEn,
      },
      {
        jwId: COURSE_JW_IDS[2],
        code: scenario.courses[2].code,
        nameCn: scenario.courses[2].nameCn,
        nameEn: scenario.courses[2].nameEn,
      },
      {
        jwId: COURSE_JW_IDS[3],
        code: scenario.courses[3].code,
        nameCn: scenario.courses[3].nameCn,
        nameEn: scenario.courses[3].nameEn,
      },
    ].map((courseSeed) =>
      prisma.course.upsert({
        where: { jwId: courseSeed.jwId },
        update: {
          ...courseSeed,
          educationLevelId: seedEducationLevel.id,
          categoryId: seedCategory.id,
          classTypeId: seedClassType.id,
          classifyId: seedClassify.id,
          gradationId: seedGradation.id,
          typeId: seedCourseType.id,
        },
        create: {
          ...courseSeed,
          educationLevelId: seedEducationLevel.id,
          categoryId: seedCategory.id,
          classTypeId: seedClassType.id,
          classifyId: seedClassify.id,
          gradationId: seedGradation.id,
          typeId: seedCourseType.id,
        },
        select: { id: true, code: true, nameCn: true },
      }),
    ),
  );

  const sectionInputs: Array<{
    jwId: number;
    code: string;
    courseId: number;
    semesterId: number;
    credits: number;
    stdCount: number;
    limitCount: number;
    teacherIndexes: number[];
    remark: string;
    groupIds: [number, number];
  }> = [
    {
      jwId: SECTION_JW_IDS[0],
      code: scenario.sections[0].code,
      courseId: courses[0].id,
      semesterId: semester.id,
      credits: scenario.sections[0].credits,
      stdCount: scenario.sections[0].stdCount,
      limitCount: scenario.sections[0].limitCount,
      teacherIndexes: [0, 1],
      remark: scenario.sections[0].remark,
      groupIds: [SCHEDULE_GROUP_JW_IDS[0], SCHEDULE_GROUP_JW_IDS[1]],
    },
    {
      jwId: SECTION_JW_IDS[1],
      code: scenario.sections[1].code,
      courseId: courses[1].id,
      semesterId: semester.id,
      credits: scenario.sections[1].credits,
      stdCount: scenario.sections[1].stdCount,
      limitCount: scenario.sections[1].limitCount,
      teacherIndexes: [1],
      remark: scenario.sections[1].remark,
      groupIds: [SCHEDULE_GROUP_JW_IDS[2], SCHEDULE_GROUP_JW_IDS[3]],
    },
    {
      jwId: SECTION_JW_IDS[2],
      code: scenario.sections[2].code,
      courseId: courses[2].id,
      semesterId: semester.id,
      credits: scenario.sections[2].credits,
      stdCount: scenario.sections[2].stdCount,
      limitCount: scenario.sections[2].limitCount,
      teacherIndexes: [2],
      remark: scenario.sections[2].remark,
      groupIds: [SCHEDULE_GROUP_JW_IDS[4], SCHEDULE_GROUP_JW_IDS[5]],
    },
    {
      jwId: SECTION_JW_IDS[3],
      code: scenario.sections[3].code,
      courseId: courses[3].id,
      semesterId: previousSemester.id,
      credits: scenario.sections[3].credits,
      stdCount: scenario.sections[3].stdCount,
      limitCount: scenario.sections[3].limitCount,
      teacherIndexes: [0],
      remark: scenario.sections[3].remark,
      groupIds: [SCHEDULE_GROUP_JW_IDS[6], SCHEDULE_GROUP_JW_IDS[7]],
    },
  ];

  const sectionRecords = await Promise.all(
    sectionInputs.map((sectionInput) =>
      prisma.section.upsert({
        where: { jwId: sectionInput.jwId },
        update: {
          code: sectionInput.code,
          courseId: sectionInput.courseId,
          semesterId: sectionInput.semesterId,
          credits: sectionInput.credits,
          stdCount: sectionInput.stdCount,
          limitCount: sectionInput.limitCount,
          period: sectionInput.credits * 16,
          periodsPerWeek: 2,
          timesPerWeek: 2,
          remark: sectionInput.remark,
          scheduleRemark: "包含早课、午后与晚课时段。",
          campusId: seedCampus.id,
          openDepartmentId: seedDepartment.id,
          roomTypeId: seedRoomType.id,
          teachLanguageId: seedTeachLanguage.id,
          examModeId: seedExamMode.id,
          teachers: {
            set: sectionInput.teacherIndexes.map((teacherIndex) => ({
              id: teachers[teacherIndex].id,
            })),
          },
          adminClasses: {
            set: [{ id: seedAdminClass.id }],
          },
        },
        create: {
          jwId: sectionInput.jwId,
          code: sectionInput.code,
          courseId: sectionInput.courseId,
          semesterId: sectionInput.semesterId,
          credits: sectionInput.credits,
          stdCount: sectionInput.stdCount,
          limitCount: sectionInput.limitCount,
          period: sectionInput.credits * 16,
          periodsPerWeek: 2,
          timesPerWeek: 2,
          remark: sectionInput.remark,
          scheduleRemark: "包含早课、午后与晚课时段。",
          campusId: seedCampus.id,
          openDepartmentId: seedDepartment.id,
          roomTypeId: seedRoomType.id,
          teachLanguageId: seedTeachLanguage.id,
          examModeId: seedExamMode.id,
          teachers: {
            connect: sectionInput.teacherIndexes.map((teacherIndex) => ({
              id: teachers[teacherIndex].id,
            })),
          },
          adminClasses: {
            connect: [{ id: seedAdminClass.id }],
          },
        },
        select: { id: true, code: true, jwId: true },
      }),
    ),
  );

  await prisma.sectionTeacher.createMany({
    data: sectionInputs.flatMap((sectionInput, sectionIndex) =>
      sectionInput.teacherIndexes.map((teacherIndex) => ({
        sectionId: sectionRecords[sectionIndex].id,
        teacherId: teachers[teacherIndex].id,
      })),
    ),
    skipDuplicates: true,
  });

  await prisma.teacherAssignment.createMany({
    data: sectionInputs.flatMap((sectionInput, sectionIndex) =>
      sectionInput.teacherIndexes.map((teacherIndex) => ({
        teacherId: teachers[teacherIndex].id,
        sectionId: sectionRecords[sectionIndex].id,
        role: "lecturer",
        period: 16,
        weekIndices: [1, 2, 3, 4, 5, 6, 7, 8],
        weekIndicesMsg: "1-8 周",
        teacherLessonTypeId: seedTeacherLessonType.id,
      })),
    ),
    skipDuplicates: true,
  });

  const sectionScheduleData = await Promise.all(
    sectionInputs.map(async (sectionInput, index) => {
      const section = sectionRecords[index];
      const [defaultGroup, altGroup] = await Promise.all([
        prisma.scheduleGroup.upsert({
          where: { jwId: sectionInput.groupIds[0] },
          update: {
            sectionId: section.id,
            no: 1,
            limitCount: sectionInput.limitCount,
            stdCount: sectionInput.stdCount,
            actualPeriods: 2,
            isDefault: true,
          },
          create: {
            jwId: sectionInput.groupIds[0],
            sectionId: section.id,
            no: 1,
            limitCount: sectionInput.limitCount,
            stdCount: sectionInput.stdCount,
            actualPeriods: 2,
            isDefault: true,
          },
          select: { id: true },
        }),
        prisma.scheduleGroup.upsert({
          where: { jwId: sectionInput.groupIds[1] },
          update: {
            sectionId: section.id,
            no: 2,
            limitCount: sectionInput.limitCount,
            stdCount: sectionInput.stdCount,
            actualPeriods: 2,
            isDefault: false,
          },
          create: {
            jwId: sectionInput.groupIds[1],
            sectionId: section.id,
            no: 2,
            limitCount: sectionInput.limitCount,
            stdCount: sectionInput.stdCount,
            actualPeriods: 2,
            isDefault: false,
          },
          select: { id: true },
        }),
      ]);

      const morningDate = makeDateAt(8, 30, index);
      const afternoonDate = makeDateAt(14, 0, index + 1);
      const morningRoom = rooms[index % rooms.length];
      const afternoonRoom = rooms[(index + 1) % rooms.length];

      const schedules: Array<Prisma.ScheduleCreateInput> = [
        {
          section: { connect: { id: section.id } },
          scheduleGroup: { connect: { id: defaultGroup.id } },
          room: morningRoom ? { connect: { id: morningRoom.id } } : undefined,
          date: morningDate,
          weekday: toWeekday(morningDate),
          startTime: 830,
          endTime: 1015,
          periods: 2,
          weekIndex: 2,
          startUnit: 1,
          endUnit: 2,
          teachers: {
            connect: sectionInput.teacherIndexes.map((teacherIndex) => ({
              id: teachers[teacherIndex].id,
            })),
          },
        },
        {
          section: { connect: { id: section.id } },
          scheduleGroup: { connect: { id: altGroup.id } },
          room: afternoonRoom
            ? { connect: { id: afternoonRoom.id } }
            : undefined,
          date: afternoonDate,
          weekday: toWeekday(afternoonDate),
          startTime: 1400,
          endTime: 1545,
          periods: 2,
          weekIndex: 2,
          startUnit: 7,
          endUnit: 8,
          teachers: {
            connect: sectionInput.teacherIndexes.map((teacherIndex) => ({
              id: teachers[teacherIndex].id,
            })),
          },
        },
      ];
      return { schedules, defaultGroupId: defaultGroup.id };
    }),
  );

  const customPlaceDate = makeDateAt(15, 30, 2);
  await Promise.all([
    ...sectionScheduleData.flatMap(({ schedules }) =>
      schedules.map((data) => prisma.schedule.create({ data })),
    ),
    prisma.schedule.create({
      data: {
        section: { connect: { id: sectionRecords[0].id } },
        scheduleGroup: {
          connect: { id: sectionScheduleData[0].defaultGroupId },
        },
        customPlace: "东校区体育场",
        date: customPlaceDate,
        weekday: toWeekday(customPlaceDate),
        startTime: 1530,
        endTime: 1700,
        periods: 2,
        weekIndex: 2,
        startUnit: 9,
        endUnit: 10,
        teachers: {
          connect: sectionInputs[0].teacherIndexes.map((teacherIndex) => ({
            id: teachers[teacherIndex].id,
          })),
        },
      },
    }),
  ]);

  const exams = await Promise.all(
    sectionRecords.map((section, index) =>
      prisma.exam.upsert({
        where: { jwId: EXAM_JW_IDS[index] },
        update: {
          sectionId: section.id,
          examBatchId: seedExamBatch.id,
          examType: 1,
          startTime: 900,
          endTime: 1100,
          examDate: makeDateAt(0, 0, index === 3 ? -40 : 10 + index),
          examTakeCount: 1,
          examMode: "闭卷",
        },
        create: {
          jwId: EXAM_JW_IDS[index],
          sectionId: section.id,
          examBatchId: seedExamBatch.id,
          examType: 1,
          startTime: 900,
          endTime: 1100,
          examDate: makeDateAt(0, 0, index === 3 ? -40 : 10 + index),
          examTakeCount: 1,
          examMode: "闭卷",
        },
        select: { id: true },
      }),
    ),
  );

  await prisma.examRoom.createMany({
    data: exams.map((exam, index) => ({
      examId: exam.id,
      room: rooms[index % rooms.length]?.nameCn ?? `考场 ${index + 1}`,
      count: 30 + index * 5,
    })),
  });

  const publishedAt = makeDateAt(9, 0, -1);

  const homeworkSeeds = [
    {
      sectionId: sectionRecords[0].id,
      title: DEV_SEED.homeworks.completedTitle,
      submissionDueAt: makeDateAt(20, 0, -2),
      isMajor: false,
      requiresTeam: false,
    },
    {
      sectionId: sectionRecords[0].id,
      title: DEV_SEED.homeworks.overdueTitle,
      submissionDueAt: makeDateAt(22, 0, -1),
      isMajor: true,
      requiresTeam: false,
    },
    {
      sectionId: sectionRecords[0].id,
      title: DEV_SEED.homeworks.dueTodayTitle,
      submissionDueAt: makeDateAt(23, 0, 0),
      isMajor: false,
      requiresTeam: false,
    },
    {
      sectionId: sectionRecords[0].id,
      title: DEV_SEED.homeworks.title,
      submissionDueAt: makeDateAt(23, 0, 4),
      isMajor: true,
      requiresTeam: true,
    },
    {
      sectionId: sectionRecords[1].id,
      title: "线性变换证明题",
      submissionDueAt: makeDateAt(22, 0, 2),
      isMajor: false,
      requiresTeam: false,
    },
    {
      sectionId: sectionRecords[1].id,
      title: "特征值综合练习",
      submissionDueAt: makeDateAt(22, 0, 6),
      isMajor: false,
      requiresTeam: false,
    },
    {
      sectionId: sectionRecords[2].id,
      title: "实验报告与误差分析",
      submissionDueAt: makeDateAt(21, 0, 3),
      isMajor: true,
      requiresTeam: true,
    },
    {
      sectionId: sectionRecords[3].id,
      title: "历史学期复盘作业",
      submissionDueAt: makeDateAt(20, 0, -40),
      isMajor: false,
      requiresTeam: false,
    },
    {
      sectionId: sectionRecords[0].id,
      title: "已删除作业",
      submissionDueAt: makeDateAt(23, 0, 5),
      isMajor: false,
      requiresTeam: false,
    },
  ];

  const homeworks = await Promise.all(
    homeworkSeeds.map((seed) =>
      prisma.homework.create({
        data: {
          ...seed,
          createdById: debugUser.id,
          updatedById: debugUser.id,
          publishedAt,
          submissionStartAt: publishedAt,
        },
        select: { id: true, title: true },
      }),
    ),
  );

  await prisma.homeworkCompletion.createMany({
    data: [
      {
        userId: debugUser.id,
        homeworkId: homeworks[0].id,
        completedAt: makeDateAt(21, 0, -2),
      },
      {
        userId: debugUser.id,
        homeworkId: homeworks[4].id,
        completedAt: makeDateAt(20, 30, 1),
      },
    ],
  });

  await prisma.homeworkAuditLog.createMany({
    data: homeworks.map((homework, index) => ({
      action: HomeworkAuditAction.created,
      titleSnapshot: homework.title,
      sectionId: sectionRecords[index % sectionRecords.length].id,
      homeworkId: homework.id,
      actorId: debugUser.id,
      createdAt: makeDateAt(9, 30, -1),
    })),
  });

  const deletedHomework = homeworks[homeworks.length - 1];
  if (deletedHomework?.title === "已删除作业") {
    await prisma.homework.update({
      where: { id: deletedHomework.id },
      data: {
        deletedAt: makeDateAt(12, 0, 0),
        deletedById: debugUser.id,
      },
    });
    await prisma.homeworkAuditLog.create({
      data: {
        action: HomeworkAuditAction.deleted,
        titleSnapshot: deletedHomework.title,
        sectionId: sectionRecords[0].id,
        homeworkId: deletedHomework.id,
        actorId: debugUser.id,
        createdAt: makeDateAt(12, 5, 0),
      },
    });
  }

  const uploads = await Promise.all(
    [
      {
        filename: "software-engineering-checklist.pdf",
        contentType: "application/pdf",
        size: 1_258_220,
      },
      {
        filename: "linear-algebra-notes.md",
        contentType: "text/markdown",
        size: 18_432,
      },
      {
        filename: "physics-lab-template.xlsx",
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        size: 94_220,
      },
    ].map((seed, index) =>
      prisma.upload.create({
        data: {
          userId: debugUser.id,
          key: `${DEV_SCENARIO_KEY_PREFIX}${Date.now()}-${index}-${seed.filename}`,
          filename: seed.filename,
          contentType: seed.contentType,
          size: seed.size,
        },
        select: { id: true, filename: true },
      }),
    ),
  );

  const sectionRootComment = await prisma.comment.create({
    data: {
      userId: debugUser.id,
      sectionId: sectionRecords[0].id,
      body: "这门课节奏快，建议每周固定做一次代码评审。",
      visibility: CommentVisibility.public,
    },
    select: { id: true },
  });

  await Promise.all([
    prisma.comment.create({
      data: {
        userId: debugUser.id,
        sectionId: sectionRecords[0].id,
        parentId: sectionRootComment.id,
        rootId: sectionRootComment.id,
        body: "回复：推荐先写测试用例再实现。",
        visibility: CommentVisibility.logged_in_only,
      },
    }),
    prisma.comment.create({
      data: {
        userId: debugUser.id,
        courseId: courses[1].id,
        body: "课程难度中上，适合作为线代进阶。",
        visibility: CommentVisibility.anonymous,
        isAnonymous: true,
        authorName: "匿名同学",
      },
      select: { id: true },
    }),
    prisma.comment.create({
      data: {
        userId: debugUser.id,
        teacherId: teachers[2].id,
        body: "实验指导细致，答疑响应很及时。",
        visibility: CommentVisibility.public,
      },
    }),
    prisma.comment.create({
      data: {
        userId: debugUser.id,
        homeworkId: homeworks[6].id,
        body: "注意提交报告时附上原始数据截图。",
        visibility: CommentVisibility.public,
        status: CommentStatus.softbanned,
        moderatedById: adminUser.id,
        moderatedAt: makeDateAt(10, 0, 0),
        moderationNote: "仅用于验证私密评论状态展示。",
      },
    }),
  ]);

  const sectionTeacherRow = await prisma.sectionTeacher.findFirst({
    where: { sectionId: sectionRecords[0].id },
    select: { id: true },
  });
  if (sectionTeacherRow) {
    await prisma.comment.create({
      data: {
        userId: debugUser.id,
        sectionTeacherId: sectionTeacherRow.id,
        body: "班级-教师评论：该教师讲解清晰。",
        visibility: CommentVisibility.public,
      },
    });
  }

  await prisma.comment.create({
    data: {
      userId: debugUser.id,
      sectionId: sectionRecords[1].id,
      body: `${DEV_SCENARIO_MARKER} 已删除评论，用于列表过滤测试。`,
      visibility: CommentVisibility.public,
      status: CommentStatus.deleted,
      deletedAt: makeDateAt(11, 0, 0),
    },
  });

  const commentWithAttachment = await prisma.comment.create({
    data: {
      userId: debugUser.id,
      sectionId: sectionRecords[2].id,
      body: "附上实验模板，方便大家统一格式。",
      visibility: CommentVisibility.public,
    },
    select: { id: true },
  });

  await prisma.commentAttachment.create({
    data: {
      commentId: commentWithAttachment.id,
      uploadId: uploads[2].id,
    },
  });

  await prisma.commentReaction.createMany({
    data: [
      {
        commentId: sectionRootComment.id,
        userId: adminUser.id,
        type: CommentReactionType.upvote,
      },
      {
        commentId: commentWithAttachment.id,
        userId: adminUser.id,
        type: CommentReactionType.heart,
      },
    ],
  });

  const homeworkDescriptionContents = [
    "作业要求：提交仓库链接和测试截图。",
    "逾期补交实验数据，保留原始记录并说明补交原因。",
    "整理今日课堂反馈，标注需要二次确认的问题。",
    "完成系统设计文档，包含模块划分与接口说明，并在评审会上做 10 分钟展示。",
    "证明题需写出完整推导过程，可参考教材第三章习题 3.2。",
    "综合运用特征值与特征向量，建议先化简再计算。",
    "实验报告需包含：实验目的、步骤、数据记录、误差分析与结论。",
    "历史学期复盘作业用于验证跨学期订阅数据。",
  ];

  const descriptions = await Promise.all([
    prisma.description.create({
      data: {
        sectionId: sectionRecords[0].id,
        content:
          "# 课程建议\n" +
          "- 每周提前阅读需求文档\n" +
          "- 课堂展示前先做一次组内彩排\n",
        lastEditedById: debugUser.id,
        lastEditedAt: makeDateAt(21, 0, -1),
      },
    }),
    prisma.description.create({
      data: {
        courseId: courses[2].id,
        content: "实验课建议准备护目镜并提前完成预习问答。",
        lastEditedById: debugUser.id,
        lastEditedAt: makeDateAt(21, 30, -1),
      },
    }),
    prisma.description.create({
      data: {
        teacherId: teachers[0].id,
        content: "老师偏好通过 PR review 反馈代码风格问题。",
        lastEditedById: debugUser.id,
        lastEditedAt: makeDateAt(22, 0, -1),
      },
    }),
    ...homeworkDescriptionContents.map((content, index) =>
      prisma.description.create({
        data: {
          homeworkId: homeworks[index].id,
          content,
          lastEditedById: debugUser.id,
          lastEditedAt: makeDateAt(22, 30 + index, -1),
        },
      }),
    ),
  ]);

  await prisma.descriptionEdit.createMany({
    data: descriptions.map((description, index) => ({
      descriptionId: description.id,
      editorId: debugUser.id,
      previousContent: "",
      nextContent: `${DEV_SCENARIO_MARKER} description edit #${index + 1}`,
      createdAt: makeDateAt(22, 40 + index, -1),
    })),
  });

  await prisma.user.update({
    where: { id: debugUser.id },
    data: {
      subscribedSections: {
        set: sectionRecords.map((section) => ({ id: section.id })),
      },
    },
  });

  const todoSeeds = [
    {
      title: DEV_SEED.todos.overdueTitle,
      content: "用于验证逾期待办展示",
      dueAt: makeDateAt(9, 0, -1),
      completed: false,
      priority: "high" as const,
    },
    {
      title: DEV_SEED.todos.dueTodayTitle,
      content: "需今日完成",
      dueAt: makeDateAt(23, 59, 0),
      completed: false,
      priority: "high" as const,
    },
    {
      title: "三天内复习安排",
      content: null,
      dueAt: makeDateAt(18, 0, 2),
      completed: false,
      priority: "medium" as const,
    },
    {
      title: "下周小组展示准备",
      content: null,
      dueAt: makeDateAt(23, 59, 7),
      completed: false,
      priority: "low" as const,
    },
    {
      title: "整理课程资料",
      content: null,
      dueAt: null,
      completed: false,
      priority: "medium" as const,
    },
    {
      title: DEV_SEED.todos.completedTitle,
      content: null,
      dueAt: makeDateAt(20, 0, -1),
      completed: true,
      priority: "high" as const,
    },
  ];
  await prisma.todo.createMany({
    data: todoSeeds.map((todo) => ({
      userId: debugUser.id,
      title: todo.title,
      content: todo.content,
      dueAt: todo.dueAt,
      completed: todo.completed,
      priority: todo.priority,
    })),
  });

  await prisma.dashboardLinkClick.createMany({
    data: scenario.dashboardLinks.clickedSlugs.map((link, index) => ({
      userId: debugUser.id,
      slug: link.slug,
      count: link.count,
      lastClickedAt: makeDateAt(10 + index, 0, 0),
    })),
    skipDuplicates: true,
  });
  await prisma.dashboardLinkPin.createMany({
    data: DEV_SEED.dashboardLinks.pinnedSlugs.map((slug) => ({
      userId: debugUser.id,
      slug,
    })),
    skipDuplicates: true,
  });

  await prisma.uploadPending.upsert({
    where: { key: `${DEV_SCENARIO_KEY_PREFIX}pending-lab-template.xlsx` },
    update: {
      filename: "pending-lab-template.xlsx",
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      size: 52_000,
      expiresAt: makeDateAt(23, 59, 1),
      userId: debugUser.id,
    },
    create: {
      key: `${DEV_SCENARIO_KEY_PREFIX}pending-lab-template.xlsx`,
      filename: "pending-lab-template.xlsx",
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      size: 52_000,
      expiresAt: makeDateAt(23, 59, 1),
      userId: debugUser.id,
    },
  });

  await prisma.verifiedEmail.deleteMany({
    where: { provider: "dev-scenario", email: `${debugUsername}@ustc.edu.cn` },
  });
  await prisma.verifiedEmail.create({
    data: {
      provider: "dev-scenario",
      email: `${debugUsername}@ustc.edu.cn`,
      userId: debugUser.id,
    },
  });

  await prisma.account.deleteMany({
    where: {
      provider: "dev-scenario-oidc",
      providerAccountId: `${debugUsername}-account`,
    },
  });
  await prisma.account.create({
    data: {
      userId: debugUser.id,
      type: "oidc",
      provider: "dev-scenario-oidc",
      providerAccountId: `${debugUsername}-account`,
      access_token: "scenario-access-token",
      token_type: "Bearer",
      scope: "openid profile email",
      expires_at: Math.floor(makeDateAt(23, 59, 1).getTime() / 1000),
    },
  });

  await prisma.session.deleteMany({
    where: {
      sessionToken: `${DEV_SCENARIO_KEY_PREFIX}session-${debugUsername}`,
    },
  });
  await prisma.session.create({
    data: {
      sessionToken: `${DEV_SCENARIO_KEY_PREFIX}session-${debugUsername}`,
      userId: debugUser.id,
      expires: makeDateAt(23, 59, 7),
    },
  });

  await prisma.verificationToken.deleteMany({
    where: {
      identifier: `${DEV_SCENARIO_KEY_PREFIX}verify-${debugUsername}`,
      token: "scenario-verify-token",
    },
  });
  await prisma.verificationToken.create({
    data: {
      identifier: `${DEV_SCENARIO_KEY_PREFIX}verify-${debugUsername}`,
      token: "scenario-verify-token",
      expires: makeDateAt(23, 59, 2),
    },
  });

  await prisma.authenticator.deleteMany({
    where: {
      credentialID: `${DEV_SCENARIO_KEY_PREFIX}credential-${debugUsername}`,
    },
  });
  await prisma.authenticator.create({
    data: {
      credentialID: `${DEV_SCENARIO_KEY_PREFIX}credential-${debugUsername}`,
      userId: debugUser.id,
      providerAccountId: `${debugUsername}-account`,
      credentialPublicKey: "scenario-public-key",
      counter: 1,
      credentialDeviceType: "singleDevice",
      credentialBackedUp: false,
      transports: "usb",
    },
  });

  await prisma.userSuspension.create({
    data: {
      userId: debugUser.id,
      createdById: adminUser.id,
      reason: `${DEV_SCENARIO_MARKER} ${DEV_SEED.suspensions.reasonKeyword}`,
      note: "用于管理端权限与解除限制流程测试。",
      expiresAt: makeDateAt(23, 59, 3),
      liftedAt: makeDateAt(9, 0, 0),
      liftedById: adminUser.id,
    },
  });

  await importBusStaticPayload(prisma, busSeed.payload, {
    versionKey: DEV_SEED.bus.versionKey,
    versionTitle: busSeed.versionTitle,
    effectiveFrom: busSeed.effectiveFrom,
    effectiveUntil: busSeed.effectiveUntil,
    disablePreviousVersions: true,
  });

  await prisma.busUserPreference.upsert({
    where: { userId: debugUser.id },
    update: {
      preferredOriginCampusId: null,
      preferredDestinationCampusId: null,
      favoriteCampusIds: [1],
      favoriteRouteIds: [],
      showDepartedTrips: false,
    },
    create: {
      userId: debugUser.id,
      preferredOriginCampusId: null,
      preferredDestinationCampusId: null,
      favoriteCampusIds: [1],
      favoriteRouteIds: [],
      showDepartedTrips: false,
    },
  });

  console.log("测试场景数据初始化完成");
  console.log(`用户: ${debugUser.username}`);
  console.log(`管理员: ${adminUser.username}`);
  console.log(`课程数: ${courses.length}, 班级数: ${sectionRecords.length}`);
  console.log(
    `作业数: ${homeworks.length}, 上传数: ${uploads.length}, 待办数: ${todoSeeds.length}`,
  );
}

async function resetMain() {
  const users = await prisma.user.findMany({
    where: { username: { in: [debugUsername, adminUsername] } },
    select: { id: true, username: true },
  });

  await cleanupDevScenarioData(
    prisma,
    users.map((user) => user.id),
    {
      removeCatalogMetadata: true,
      userSuspensions: "byMarker",
    },
  );

  console.log("开发调试场景数据清理完成");
  console.log(`已处理用户数: ${users.length}`);
}

const isReset = process.argv.includes("--reset");
const selectedMain = isReset ? resetMain : main;

selectedMain()
  .catch((error: unknown) => {
    const err = error as Error;
    console.error(
      isReset ? "开发调试场景数据清理失败" : "测试场景数据初始化失败",
      err.message,
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectToolPrisma(prisma);
  });
