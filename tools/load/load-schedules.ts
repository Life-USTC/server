import type {
  AdminClass,
  Building,
  Campus,
  Prisma,
  PrismaClient,
  Room,
  RoomType,
  ScheduleGroup,
  Section,
  Teacher,
  TeacherLessonType,
  TeacherTitle,
} from "../../src/generated/prisma-node/client";
import { parseDateInput } from "../../src/lib/time/parse-date-input";

interface ContactInfoInterface {
  email: string | null;
  telephone: string | null;
  mobile: string | null;
  address: string | null;
  postcode: string | null;
  qq: string | null;
  wechat: string | null;
}

interface TeacherTitleInterface {
  nameZh: string;
  nameEn: string | null;
  id: number;
  code: string;
  enabled: boolean;
}

interface TeacherLessonTypeInterface {
  id: number;
  nameZh: string;
  nameEn: string | null;
  code: string;
  role: string;
  enabled: boolean;
}

interface TeacherAssignmentInterface {
  role: string;
  code: string;
  teacherId: number;
  personId: number;
  name: string;
  age: number;
  titleName: string;
  title: TeacherTitleInterface;
  period: number;
  teacherLessonType: TeacherLessonTypeInterface;
  contactInfo: ContactInfoInterface;
  weekIndices: number[];
  weekIndicesMsg: string | null;
}

interface AdminClassInterface {
  id: number;
  nameZh: string;
  nameEn: string | null;
  code: string;
  grade: string;
  stdCount: number;
  planCount: number;
  enabled: boolean;
  abbrZh: string;
  abbrEn: string;
}

interface RequiredPeriodInfoInterface {
  total: number;
  weeks: number;
  theory: number;
  theoryUnit: number | null;
  requireTheory: number | null;
  practice: number;
  practiceUnit: number | null;
  requirePractice: number | null;
  test: number | null;
  testUnit: number | null;
  requireTest: number | null;
  experiment: number;
  experimentUnit: number | null;
  requireExperiment: number | null;
  machine: number | null;
  machineUnit: number | null;
  requireMachine: number | null;
  design: number | null;
  designUnit: number | null;
  requireDesign: number | null;
  periodsPerWeek: number;
  timesPerWeek: number;
}

interface LessonInterface {
  id: number;
  code: string;
  name: string;
  courseId: number;
  bizTypeId: number;
  courseName: string;
  courseTypeName: string;
  teacherAssignmentList: TeacherAssignmentInterface[];
  requiredPeriodInfo: RequiredPeriodInfoInterface;
  actualPeriods: number;
  scheduleState: string;
  limitCount: number;
  stdCount: number;
  suggestScheduleWeeks: number[];
  suggestScheduleWeekInfo: string;
  campusId: number;
  roomTypeId: number | null;
  adminclassIds: number[];
  remark: string | null;
  scheduleRemark: string | null;
  adminclasses: AdminClassInterface[];
  scheduleJsonParams: Prisma.InputJsonArray;
  selectedStdCount: number;
}

interface CampusInterface {
  id: number;
  nameZh: string;
  nameEn: string | null;
  code: string;
}

interface BuildingInterface {
  id: number;
  nameZh: string;
  nameEn: string | null;
  code: string;
  campus: CampusInterface;
}

interface RoomTypeInterface {
  id: number;
  nameZh: string;
  nameEn: string | null;
  code: string;
}

interface RoomInterface {
  id: number;
  nameZh: string;
  nameEn: string | null;
  code: string;
  building: BuildingInterface;
  roomType: RoomTypeInterface;
  floor: number;
  virtual: boolean;
  seatsForLesson: number;
  remark: string | null;
  seats: number;
}

interface ScheduleInterface {
  lessonId: number;
  scheduleGroupId: number;
  periods: number;
  date: string;
  room: RoomInterface;
  weekday: number;
  startTime: number;
  endTime: number;
  teacherId: number | null;
  personId: number | null;
  personName: string;
  experiment: string | null;
  customPlace: string | null;
  lessonType: string | null;
  weekIndex: number;
  exerciseClass: boolean | null;
  startUnit: number;
  endUnit: number;
}

interface ScheduleGroupInterface {
  id: number;
  lessonId: number;
  no: number;
  limitCount: number;
  stdCount: number;
  actualPeriods: number;
  default: boolean;
}

export interface ScheduleDataInterface {
  result: {
    lessonList: LessonInterface[];
    scheduleList: ScheduleInterface[];
    scheduleGroupList: ScheduleGroupInterface[];
  };
}

const startTimeSlots = [
  750, 840, 945, 1035, 1125, 1400, 1450, 1555, 1645, 1735, 1930, 2020, 2110,
];
const endTimeSlots = [
  835, 925, 1030, 1120, 1210, 1445, 1535, 1640, 1730, 1820, 2015, 2105, 2155,
];

function findNearestTimeSlot(time: number, slots: number[]): number | null {
  if (!Number.isFinite(time)) {
    return null;
  }
  let nearest = slots[0];
  let minDelta = Math.abs(time - nearest);
  for (const slot of slots) {
    const delta = Math.abs(time - slot);
    if (delta < minDelta) {
      minDelta = delta;
      nearest = slot;
    }
  }
  const index = slots.indexOf(nearest);
  return index === -1 ? null : index + 1;
}

async function loadCampus(
  data: CampusInterface,
  prisma: PrismaClient,
): Promise<Campus | null> {
  if (!data) {
    return null;
  }
  return await prisma.campus.upsert({
    where: { nameCn: data.nameZh },
    update: {
      jwId: data.id,
      nameCn: data.nameZh,
      nameEn: data.nameEn,
      code: data.code,
    },
    create: {
      jwId: data.id,
      nameCn: data.nameZh,
      nameEn: data.nameEn,
      code: data.code,
    },
  });
}

async function loadBuilding(
  data: BuildingInterface,
  campusId: number,
  prisma: PrismaClient,
): Promise<Building | null> {
  if (!data) {
    return null;
  }
  return await prisma.building.upsert({
    where: { jwId: data.id },
    update: {
      code: data.code,
      nameCn: data.nameZh,
      nameEn: data.nameEn,
      campusId: campusId,
    },
    create: {
      jwId: data.id,
      code: data.code,
      nameCn: data.nameZh,
      nameEn: data.nameEn,
      campusId: campusId,
    },
  });
}

async function loadRoomType(
  data: RoomTypeInterface,
  prisma: PrismaClient,
): Promise<RoomType | null> {
  if (!data) {
    return null;
  }
  return await prisma.roomType.upsert({
    where: { jwId: data.id },
    update: {
      code: data.code,
      nameCn: data.nameZh,
      nameEn: data.nameEn,
    },
    create: {
      jwId: data.id,
      code: data.code,
      nameCn: data.nameZh,
      nameEn: data.nameEn,
    },
  });
}

async function loadRoom(
  data: RoomInterface,
  prisma: PrismaClient,
): Promise<Room | null> {
  if (!data?.building || !data?.roomType) {
    return null;
  }

  const campus = await loadCampus(data.building.campus, prisma);
  if (!campus) {
    return null;
  }
  const building = await loadBuilding(data.building, campus.id, prisma);
  const roomType = await loadRoomType(data.roomType, prisma);

  return await prisma.room.upsert({
    where: { jwId: data.id },
    update: {
      code: data.code,
      nameCn: data.nameZh,
      nameEn: data.nameEn,
      floor: data.floor,
      virtual: data.virtual,
      seatsForSection: data.seatsForLesson,
      remark: data.remark,
      seats: data.seats,
      buildingId: building?.id,
      roomTypeId: roomType?.id,
    },
    create: {
      jwId: data.id,
      code: data.code,
      nameCn: data.nameZh,
      nameEn: data.nameEn,
      floor: data.floor,
      virtual: data.virtual,
      seatsForSection: data.seatsForLesson,
      remark: data.remark,
      seats: data.seats,
      buildingId: building?.id,
      roomTypeId: roomType?.id,
    },
  });
}

async function loadTeacherTitle(
  data: TeacherTitleInterface,
  prisma: PrismaClient,
): Promise<TeacherTitle | null> {
  if (!data) {
    return null;
  }

  return await prisma.teacherTitle.upsert({
    where: { jwId: data.id },
    update: {
      nameCn: data.nameZh,
      nameEn: data.nameEn,
      code: data.code,
      enabled: data.enabled,
    },
    create: {
      jwId: data.id,
      nameCn: data.nameZh,
      nameEn: data.nameEn,
      code: data.code,
      enabled: data.enabled,
    },
  });
}

async function loadTeacherLessonType(
  data: TeacherLessonTypeInterface,
  prisma: PrismaClient,
): Promise<TeacherLessonType | null> {
  if (!data) {
    return null;
  }
  return await prisma.teacherLessonType.upsert({
    where: { jwId: data.id },
    update: {
      nameCn: data.nameZh,
      nameEn: data.nameEn,
      code: data.code,
      role: data.role,
      enabled: data.enabled,
    },
    create: {
      jwId: data.id,
      nameCn: data.nameZh,
      nameEn: data.nameEn,
      code: data.code,
      role: data.role,
      enabled: data.enabled,
    },
  });
}

async function loadTeacher(
  teacherId: number | null,
  personId: number | null,
  personName: string,
  prisma: PrismaClient,
): Promise<Teacher | null> {
  let teacher = null;

  if (personId) {
    teacher = await prisma.teacher.findFirst({
      where: { personId },
    });
  }

  if (!teacher && teacherId) {
    teacher = await prisma.teacher.findFirst({
      where: { teacherId },
    });
  }

  if (!teacher) {
    teacher = await prisma.teacher.findFirst({
      where: {
        nameCn: personName,
        teacherId: null,
        personId: null,
      },
    });
  }

  if (!teacher) {
    teacher = await prisma.teacher.create({
      data: {
        personId,
        teacherId,
        nameCn: personName,
      },
    });
  } else {
    await prisma.teacher.update({
      where: { id: teacher.id },
      data: {
        personId: personId || teacher.personId,
        teacherId: teacherId || teacher.teacherId,
        nameCn: personName,
      },
    });
    teacher = await prisma.teacher.findUnique({
      where: { id: teacher.id },
    });
  }

  return teacher;
}

async function loadTeacherFromAssignment(
  data: TeacherAssignmentInterface,
  prisma: PrismaClient,
): Promise<Teacher | null> {
  if (!data) {
    return null;
  }
  const title = await loadTeacherTitle(data.title, prisma);

  const teacher = await prisma.teacher.upsert({
    where: { personId: data.personId },
    update: {
      teacherId: data.teacherId,
      code: data.code,
      nameCn: data.name,
      age: data.age,
      email: data.contactInfo.email,
      telephone: data.contactInfo.telephone,
      mobile: data.contactInfo.mobile,
      address: data.contactInfo.address,
      postcode: data.contactInfo.postcode,
      qq: data.contactInfo.qq,
      wechat: data.contactInfo.wechat,
      teacherTitleId: title?.id,
    },
    create: {
      personId: data.personId,
      teacherId: data.teacherId,
      code: data.code,
      nameCn: data.name,
      age: data.age,
      email: data.contactInfo.email,
      telephone: data.contactInfo.telephone,
      mobile: data.contactInfo.mobile,
      address: data.contactInfo.address,
      postcode: data.contactInfo.postcode,
      qq: data.contactInfo.qq,
      wechat: data.contactInfo.wechat,
      teacherTitleId: title?.id,
    },
  });

  return teacher;
}

async function loadAdminClass(
  data: AdminClassInterface,
  prisma: PrismaClient,
): Promise<AdminClass | null> {
  if (!data) {
    return null;
  }
  return await prisma.adminClass.upsert({
    where: { nameCn: data.nameZh },
    update: {
      jwId: data.id,
      code: data.code,
      grade: data.grade,
      nameCn: data.nameZh,
      nameEn: data.nameEn,
      stdCount: data.stdCount,
      planCount: data.planCount,
      enabled: data.enabled,
      abbrZh: data.abbrZh,
      abbrEn: data.abbrEn,
    },
    create: {
      jwId: data.id,
      code: data.code,
      grade: data.grade,
      nameCn: data.nameZh,
      nameEn: data.nameEn,
      stdCount: data.stdCount,
      planCount: data.planCount,
      enabled: data.enabled,
      abbrZh: data.abbrZh,
      abbrEn: data.abbrEn,
    },
  });
}

async function loadScheduleGroup(
  data: ScheduleGroupInterface,
  sectionId: number,
  prisma: PrismaClient,
): Promise<ScheduleGroup | null> {
  if (!data) {
    return null;
  }
  const scheduleGroup = await prisma.scheduleGroup.upsert({
    where: { jwId: data.id },
    update: {
      sectionId,
      no: data.no,
      limitCount: data.limitCount,
      stdCount: data.stdCount,
      actualPeriods: data.actualPeriods,
      isDefault: data.default,
    },
    create: {
      jwId: data.id,
      sectionId,
      no: data.no,
      limitCount: data.limitCount,
      stdCount: data.stdCount,
      actualPeriods: data.actualPeriods,
      isDefault: data.default,
    },
  });
  return scheduleGroup;
}

async function loadSchedule(
  data: ScheduleInterface,
  teachers: Array<{
    teacherId: number | null;
    personId: number | null;
    personName: string;
  }>,
  sectionId: number,
  prisma: PrismaClient,
) {
  const room = await loadRoom(data.room, prisma);

  // Load all teachers for this schedule
  const teacherRecords = await Promise.all(
    teachers.map((t) =>
      loadTeacher(t.teacherId, t.personId, t.personName, prisma),
    ),
  );

  // Filter out null teachers
  const validTeachers = teacherRecords.filter((t) => t !== null);

  const scheduleGroup = await prisma.scheduleGroup.findFirst({
    where: { jwId: data.scheduleGroupId },
  });

  if (!scheduleGroup) {
    return;
  }

  const scheduleDate = parseDateInput(data.date);
  if (!(scheduleDate instanceof Date)) {
    console.warn(
      `[load-schedules] Invalid schedule date for scheduleGroupId=${data.scheduleGroupId}, date=${data.date}`,
    );
    return;
  }
  const startUnit = findNearestTimeSlot(data.startTime, startTimeSlots);
  const endUnit = findNearestTimeSlot(data.endTime, endTimeSlots);

  // Create schedule with all teachers at once
  return prisma.schedule.create({
    data: {
      sectionId,
      scheduleGroupId: scheduleGroup.id,
      roomId: room?.id || null,
      teachers:
        validTeachers.length > 0
          ? {
              connect: validTeachers.map((t) => ({ id: t.id })),
            }
          : undefined,
      periods: data.periods,
      date: scheduleDate,
      weekday: data.weekday,
      startTime: data.startTime,
      endTime: data.endTime,
      experiment: data.experiment || null,
      customPlace: data.customPlace || null,
      lessonType: data.lessonType || null,
      weekIndex: data.weekIndex,
      exerciseClass: data.exerciseClass || false,
      startUnit: startUnit ?? data.startUnit ?? 0,
      endUnit: endUnit ?? data.endUnit ?? 0,
    },
  });
}

async function createTeacherAssignment(
  teacherAssignment: TeacherAssignmentInterface,
  sectionId: number,
  prisma: PrismaClient,
) {
  const teacher = await loadTeacherFromAssignment(teacherAssignment, prisma);
  if (!teacher) {
    return;
  }
  const lessonType = await loadTeacherLessonType(
    teacherAssignment.teacherLessonType,
    prisma,
  );

  await prisma.teacherAssignment.upsert({
    where: {
      teacherId_sectionId: {
        teacherId: teacher.id,
        sectionId: sectionId,
      },
    },
    update: {
      role: teacherAssignment.role,
      period: teacherAssignment.period,
      weekIndices: teacherAssignment.weekIndices,
      weekIndicesMsg: teacherAssignment.weekIndicesMsg,
      teacherLessonTypeId: lessonType?.id,
    },
    create: {
      teacherId: teacher.id,
      sectionId: sectionId,
      role: teacherAssignment.role,
      period: teacherAssignment.period,
      weekIndices: teacherAssignment.weekIndices,
      weekIndicesMsg: teacherAssignment.weekIndicesMsg,
      teacherLessonTypeId: lessonType?.id,
    },
  });
}

async function updateSectionFromLesson(
  lesson: LessonInterface,
  sectionId: number,
  prisma: PrismaClient,
) {
  const adminClasses = [];
  for (const ac of lesson.adminclasses) {
    const adminClass = await loadAdminClass(ac, prisma);
    adminClasses.push(adminClass);
  }

  const roomType = await prisma.roomType.findFirst({
    where: { jwId: lesson.roomTypeId || -1 },
  });

  await prisma.section.update({
    where: { id: sectionId },
    data: {
      bizTypeId: lesson.bizTypeId,
      actualPeriods: lesson.actualPeriods,
      theoryPeriods: lesson.requiredPeriodInfo.theory,
      practicePeriods: lesson.requiredPeriodInfo.practice,
      experimentPeriods: lesson.requiredPeriodInfo.experiment,
      machinePeriods: lesson.requiredPeriodInfo.machine,
      designPeriods: lesson.requiredPeriodInfo.design,
      testPeriods: lesson.requiredPeriodInfo.test,
      timesPerWeek: lesson.requiredPeriodInfo.timesPerWeek,
      scheduleState: lesson.scheduleState,
      suggestScheduleWeeks: lesson.suggestScheduleWeeks,
      suggestScheduleWeekInfo: lesson.suggestScheduleWeekInfo,
      scheduleJsonParams: lesson.scheduleJsonParams,
      selectedStdCount: lesson.selectedStdCount,
      remark: lesson.remark,
      scheduleRemark: lesson.scheduleRemark,
      roomTypeId: roomType?.id,
      adminClasses: {
        set: adminClasses.map((ac) => ({ id: ac?.id })),
      },
    },
  });

  for (const teacherAssignment of lesson.teacherAssignmentList) {
    await createTeacherAssignment(teacherAssignment, sectionId, prisma);
  }
}

export async function loadSchedules(
  data: ScheduleDataInterface,
  section: Section,
  prisma: PrismaClient,
) {
  const result = data.result;
  await prisma.schedule.deleteMany({ where: { sectionId: section.id } });

  for (const groupData of result.scheduleGroupList || []) {
    await loadScheduleGroup(groupData, section.id, prisma);
  }

  // Group schedules by unique time slot (scheduleGroupId, date, startTime, endTime)
  const scheduleMap = new Map<
    string,
    {
      data: ScheduleInterface;
      teachers: Array<{
        teacherId: number | null;
        personId: number | null;
        personName: string;
      }>;
    }
  >();

  for (const scheduleData of result.scheduleList || []) {
    const key = `${scheduleData.scheduleGroupId}-${scheduleData.date}-${scheduleData.startTime}-${scheduleData.endTime}`;

    const entry = scheduleMap.get(key);
    if (entry) {
      entry.teachers.push({
        teacherId: scheduleData.teacherId || null,
        personId: scheduleData.personId || null,
        personName: scheduleData.personName || "未知教师",
      });
    } else {
      scheduleMap.set(key, {
        data: scheduleData,
        teachers: [
          {
            teacherId: scheduleData.teacherId || null,
            personId: scheduleData.personId || null,
            personName: scheduleData.personName || "未知教师",
          },
        ],
      });
    }
  }

  // Load each unique schedule with all its teachers
  for (const entry of scheduleMap.values()) {
    await loadSchedule(entry.data, entry.teachers, section.id, prisma);
  }

  if (result.lessonList && result.lessonList.length > 0) {
    const lesson = result.lessonList.find((l) => l.id === section.jwId);
    if (lesson) {
      await updateSectionFromLesson(lesson, section.id, prisma);
    }
  }
}
