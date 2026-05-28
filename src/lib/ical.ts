import {
  ICalCalendar,
  ICalCategory,
  ICalEventBusyStatus,
} from "ical-generator";
import type { Prisma } from "@/generated/prisma/client";
import type { AppLocale } from "@/i18n/config";
import {
  loadBuildingImgRules,
  loadGeoData,
  lookupBuildingImagePath,
  lookupLocationGeo,
} from "@/lib/location-utils";
import { APP_TIME_ZONE } from "@/lib/time/parse-date-input";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";

/* ------------------------------------------------------------------ */
/*  iCal locale labels                                                 */
/* ------------------------------------------------------------------ */

const LABELS: Record<
  AppLocale,
  {
    courseCategory: string;
    examCategory: string;
    homeworkCategory: string;
    todoCategory: string;
    majorHomework: string;
    requiresTeam: string;
    teacherPrefix: string;
    experimentPrefix: string;
    examTypePrefix: string;
    examModePrefix: string;
    examTakeCountPrefix: string;
    examRoomPrefix: string;
    homeworkDuePrefix: string;
    todoDuePrefix: string;
    priorityHigh: string;
    priorityMedium: string;
    priorityLow: string;
    examTypeLabels: Record<number, string>;
    examTypeFallback: string;
    locationTbd: string;
    examLocationTbd: string;
  }
> = {
  "zh-cn": {
    courseCategory: "课程",
    examCategory: "考试",
    homeworkCategory: "作业",
    todoCategory: "待办",
    majorHomework: "重要作业",
    requiresTeam: "需要组队",
    teacherPrefix: "教师：",
    experimentPrefix: "实验：",
    examTypePrefix: "类型：",
    examModePrefix: "考试方式：",
    examTakeCountPrefix: "考试人数：",
    examRoomPrefix: "考场：",
    homeworkDuePrefix: "作业截止：",
    todoDuePrefix: "待办截止：",
    priorityHigh: "高优先级",
    priorityMedium: "中优先级",
    priorityLow: "低优先级",
    examTypeLabels: { 1: "期中考试", 2: "期末考试" },
    examTypeFallback: "考试",
    locationTbd: "地点待定",
    examLocationTbd: "考场待定",
  },
  "en-us": {
    courseCategory: "Course",
    examCategory: "Exam",
    homeworkCategory: "Homework",
    todoCategory: "Todo",
    majorHomework: "Major Homework",
    requiresTeam: "Requires Team",
    teacherPrefix: "Teacher: ",
    experimentPrefix: "Experiment: ",
    examTypePrefix: "Type: ",
    examModePrefix: "Mode: ",
    examTakeCountPrefix: "Take Count: ",
    examRoomPrefix: "Room: ",
    homeworkDuePrefix: "HW Due: ",
    todoDuePrefix: "Todo Due: ",
    priorityHigh: "High Priority",
    priorityMedium: "Medium Priority",
    priorityLow: "Low Priority",
    examTypeLabels: { 1: "Midterm", 2: "Final" },
    examTypeFallback: "Exam",
    locationTbd: "Location TBD",
    examLocationTbd: "Exam Location TBD",
  },
};

function getLabels(locale: AppLocale) {
  return LABELS[locale] ?? LABELS["zh-cn"];
}

function examTypeLabel(examType: number | null, locale: AppLocale): string {
  const labels = getLabels(locale);
  return labels.examTypeLabels[examType ?? -1] ?? labels.examTypeFallback;
}

function priorityLabel(priority: string, locale: AppLocale): string {
  const labels = getLabels(locale);
  const map: Record<string, string> = {
    high: labels.priorityHigh,
    medium: labels.priorityMedium,
    low: labels.priorityLow,
  };
  return map[priority] ?? labels.priorityLow;
}

/* ------------------------------------------------------------------ */
/*  iCal timezone & helpers                                           */
/* ------------------------------------------------------------------ */

function generateShanghaiVTimezone(timezone: string): string | null {
  if (timezone !== APP_TIME_ZONE) return null;
  return [
    "BEGIN:VTIMEZONE",
    `TZID:${APP_TIME_ZONE}`,
    `X-LIC-LOCATION:${APP_TIME_ZONE}`,
    "BEGIN:STANDARD",
    "TZOFFSETFROM:+0800",
    "TZOFFSETTO:+0800",
    "TZNAME:CST",
    "DTSTART:19700101T000000",
    "END:STANDARD",
    "END:VTIMEZONE",
  ].join("\r\n");
}

const SHANGHAI_TZ_CONFIG = {
  name: APP_TIME_ZONE,
  generator: generateShanghaiVTimezone,
};

function parseTimeHHMM(date: Date, hhmm: number) {
  return shanghaiDayjs(date)
    .hour(Math.floor(hhmm / 100))
    .minute(hhmm % 100)
    .second(0);
}

function toCategories(names: (string | null | undefined)[]): ICalCategory[] {
  return names
    .filter((n) => n && n.trim() !== "")
    .map((n) => new ICalCategory({ name: n as string }));
}

type GeoData = Awaited<ReturnType<typeof loadGeoData>>;
type ImgRules = Awaited<ReturnType<typeof loadBuildingImgRules>>;

function buildLocationField(locationTitle: string, geoData: GeoData) {
  const geo = lookupLocationGeo(geoData, locationTitle);
  return {
    title: locationTitle,
    address: "",
    radius: 10,
    geo: geo ? { lat: geo.latitude, lon: geo.longitude } : undefined,
  };
}

async function loadLocationAssets() {
  return Promise.all([loadGeoData(), loadBuildingImgRules()]);
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type CalendarSection = Prisma.SectionGetPayload<{
  include: {
    course: true;
    schedules: {
      include: {
        room: { include: { building: { include: { campus: true } } } };
        teachers: true;
      };
    };
    exams: { include: { examRooms: true } };
  };
}>;

type CalendarHomework = Prisma.HomeworkGetPayload<{
  include: {
    description: { select: { content: true } };
    section: { include: { course: true } };
  };
}>;

type CalendarTodo = {
  id: string;
  title: string;
  content: string | null;
  dueAt: Date;
  priority: "low" | "medium" | "high";
};

/* ------------------------------------------------------------------ */
/*  Calendar creation (public API)                                     */
/* ------------------------------------------------------------------ */

const SITE_URL = "https://life-ustc.tiankaima.dev";

function createCalendar(name: string, description: string, url: string) {
  return new ICalCalendar({
    name,
    description,
    timezone: SHANGHAI_TZ_CONFIG,
    url,
    scale: "GREGORIAN",
  });
}

export async function createSectionCalendar(
  section: CalendarSection,
  locale: AppLocale = "zh-cn",
) {
  const calendar = createCalendar(
    `${section.course.nameCn} (${section.code})`,
    `Calendar for ${section.course.nameCn} (${section.code}), brought to you by Life@USTC`,
    `${SITE_URL}/sections/${section.jwId}`,
  );

  const [geoData, imgRules] = await loadLocationAssets();
  appendSectionEvents(calendar, [section], geoData, imgRules, locale);
  return calendar;
}

export async function createMultiSectionCalendar(
  sections: CalendarSection[],
  locale: AppLocale = "zh-cn",
) {
  const calendar = createCalendar(
    "Life @ USTC",
    `Calendar for subscribed courses, brought to you by Life@USTC <${SITE_URL}/>`,
    SITE_URL,
  );

  const [geoData, imgRules] = await loadLocationAssets();
  appendSectionEvents(calendar, sections, geoData, imgRules, locale);
  return calendar;
}

export async function createUserCalendar({
  sections,
  homeworks,
  todos,
  locale = "zh-cn",
}: {
  sections: CalendarSection[];
  homeworks: CalendarHomework[];
  todos: CalendarTodo[];
  locale?: AppLocale;
}) {
  const calendar = createCalendar(
    "Life @ USTC",
    `Calendar for the current user, including subscribed courses and personal deadlines, brought to you by Life@USTC <${SITE_URL}/>`,
    SITE_URL,
  );

  const [geoData, imgRules] = await loadLocationAssets();
  appendSectionEvents(calendar, sections, geoData, imgRules, locale);
  for (const hw of homeworks) createHomeworkEvent(hw, calendar, locale);
  for (const todo of todos) createTodoEvent(todo, calendar, locale);
  return calendar;
}

/* ------------------------------------------------------------------ */
/*  Section event batching                                             */
/* ------------------------------------------------------------------ */

function appendSectionEvents(
  calendar: ICalCalendar,
  sections: CalendarSection[],
  geoData: GeoData,
  imgRules: ImgRules,
  locale: AppLocale,
) {
  for (const section of sections) {
    for (const schedule of section.schedules) {
      createScheduleEvent(
        schedule,
        section,
        calendar,
        geoData,
        imgRules,
        locale,
      );
    }
    for (const exam of section.exams) {
      createExamEvent(exam, section, calendar, geoData, imgRules, locale);
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Schedule event                                                     */
/* ------------------------------------------------------------------ */

function createScheduleEvent(
  schedule: Prisma.ScheduleGetPayload<{
    include: {
      room: { include: { building: { include: { campus: true } } } };
      teachers: true;
    };
  }>,
  section: Prisma.SectionGetPayload<{ include: { course: true } }>,
  calendar: ICalCalendar,
  geoData: GeoData,
  imgRules: ImgRules,
  locale: AppLocale,
) {
  if (!schedule.date) return;

  const L = getLabels(locale);
  const start = parseTimeHHMM(schedule.date, schedule.startTime);
  const end = parseTimeHHMM(schedule.date, schedule.endTime);

  const location = schedule.room?.building?.campus
    ? `${schedule.room.nameCn} (${schedule.room.building.campus.nameCn}-${schedule.room.building.nameCn})`
    : schedule.customPlace || L.locationTbd;

  const teacherNames =
    schedule.teachers?.length > 0
      ? schedule.teachers
          .map((t) => [t.nameCn, t.nameEn].filter(Boolean).join(" / "))
          .join(", ")
      : "";

  const description = [
    section.course.nameCn,
    teacherNames && `${L.teacherPrefix}${teacherNames}`,
    schedule.experiment && `${L.experimentPrefix}${schedule.experiment}`,
  ]
    .filter(Boolean)
    .join("\n");

  const buildingImg = schedule.room?.code
    ? lookupBuildingImagePath(imgRules, schedule.room.code)
    : null;

  calendar.createEvent({
    start,
    end,
    timezone: APP_TIME_ZONE,
    summary: section.course.nameCn,
    description,
    location: buildLocationField(location, geoData),
    id: `${SITE_URL}/schedule/${schedule.id}`,
    sequence: 0,
    busystatus: ICalEventBusyStatus.BUSY,
    categories: toCategories([
      L.courseCategory,
      section.course.nameCn,
      section.code,
      section.course.code,
    ]),
    attachments: buildingImg ? [buildingImg] : undefined,
  });
}

/* ------------------------------------------------------------------ */
/*  Exam event                                                         */
/* ------------------------------------------------------------------ */

function createExamEvent(
  exam: Prisma.ExamGetPayload<{ include: { examRooms: true } }>,
  section: Prisma.SectionGetPayload<{ include: { course: true } }>,
  calendar: ICalCalendar,
  geoData: GeoData,
  imgRules: ImgRules,
  locale: AppLocale,
) {
  if (!exam.examDate) return;

  const L = getLabels(locale);
  const start = parseTimeHHMM(exam.examDate, exam.startTime ?? 0);
  const end = parseTimeHHMM(exam.examDate, exam.endTime ?? 0);

  const rooms = exam.examRooms
    .map((r) => r.room)
    .filter(Boolean)
    .join(", ");
  const location = rooms || L.examLocationTbd;
  const typeLabel = examTypeLabel(exam.examType, locale);

  const description = [
    `${section.course.nameCn} (${section.code})`,
    `${L.examTypePrefix}${typeLabel}`,
    exam.examMode && `${L.examModePrefix}${exam.examMode}`,
    exam.examTakeCount && `${L.examTakeCountPrefix}${exam.examTakeCount}`,
    rooms && `${L.examRoomPrefix}${rooms}`,
  ]
    .filter(Boolean)
    .join("\n");

  const buildingImg =
    exam.examRooms.length > 0
      ? lookupBuildingImagePath(imgRules, exam.examRooms[0].room)
      : null;

  calendar.createEvent({
    start,
    end,
    timezone: APP_TIME_ZONE,
    summary: `${section.course.nameCn} - ${typeLabel}`,
    description,
    location: buildLocationField(location, geoData),
    id: `${SITE_URL}/exam/${exam.id}`,
    sequence: 0,
    busystatus: ICalEventBusyStatus.BUSY,
    categories: toCategories([
      L.examCategory,
      typeLabel,
      section.course.nameCn,
      section.code,
      section.course.code,
    ]),
    attachments: buildingImg ? [buildingImg] : undefined,
  });
}

/* ------------------------------------------------------------------ */
/*  Homework event                                                     */
/* ------------------------------------------------------------------ */

function createHomeworkEvent(
  homework: CalendarHomework,
  calendar: ICalCalendar,
  locale: AppLocale,
) {
  if (!homework.submissionDueAt) return;

  const L = getLabels(locale);
  const dueDate = shanghaiDayjs(homework.submissionDueAt);
  const courseName = homework.section.course.nameCn;
  const section = homework.section;

  const description = [
    `${courseName} (${section.code})`,
    homework.isMajor ? L.majorHomework : null,
    homework.requiresTeam ? L.requiresTeam : null,
    homework.description?.content?.trim() || null,
  ]
    .filter(Boolean)
    .join("\n");

  calendar.createEvent({
    start: dueDate,
    end: dueDate.add(30, "minute"),
    timezone: APP_TIME_ZONE,
    summary: `${courseName} - ${L.homeworkDuePrefix}${homework.title}`,
    description,
    id: `${SITE_URL}/homework/${homework.id}`,
    sequence: 0,
    busystatus: ICalEventBusyStatus.FREE,
    categories: toCategories([
      L.homeworkCategory,
      courseName,
      section.code,
      section.course.code,
      homework.isMajor ? L.majorHomework : null,
    ]),
  });
}

/* ------------------------------------------------------------------ */
/*  Todo event                                                         */
/* ------------------------------------------------------------------ */

function createTodoEvent(
  todo: CalendarTodo,
  calendar: ICalCalendar,
  locale: AppLocale,
) {
  const L = getLabels(locale);
  const dueDate = shanghaiDayjs(todo.dueAt);
  const pLabel = priorityLabel(todo.priority, locale);

  const description = [pLabel, todo.content?.trim() || null]
    .filter(Boolean)
    .join("\n");

  calendar.createEvent({
    start: dueDate,
    end: dueDate.add(30, "minute"),
    timezone: APP_TIME_ZONE,
    summary: `${L.todoDuePrefix}${todo.title}`,
    description,
    id: `${SITE_URL}/todo/${todo.id}`,
    sequence: 0,
    busystatus: ICalEventBusyStatus.FREE,
    categories: toCategories([L.todoCategory, pLabel]),
  });
}
