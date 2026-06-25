import { z } from "zod";
import type {
  SnapshotBusCampus,
  SnapshotBusNotice,
  SnapshotBusRoute,
  SnapshotBusRouteStop,
  SnapshotBusTrip,
  SnapshotBusTripStopTime,
  SnapshotCourse,
  SnapshotExam,
  SnapshotLecture,
  SnapshotSemester,
} from "./static-snapshot";

type StaticSnapshotRowsByKind = {
  semesters: SnapshotSemester;
  courses: SnapshotCourse;
  lectures: SnapshotLecture;
  exams: SnapshotExam;
  busNotice: SnapshotBusNotice;
  busCampuses: SnapshotBusCampus;
  busRoutes: SnapshotBusRoute;
  busRouteStops: SnapshotBusRouteStop;
  busTrips: SnapshotBusTrip;
  busTripStopTimes: SnapshotBusTripStopTime;
};

export type StaticSnapshotRowKind = keyof StaticSnapshotRowsByKind;

const integer = z.number().int();
const numeric = z.number().finite();
const nullableString = z.string().nullable();
const dayType = z.enum(["weekday", "weekend"]);

const rowSchemas = {
  semesters: z.object({
    id: z.string(),
    name: z.string(),
    start_date: integer,
    end_date: integer,
  }),
  courses: z.object({
    id: integer,
    semester_id: z.string(),
    name: z.string(),
    course_code: z.string(),
    lesson_code: z.string(),
    teacher_name: z.string(),
    date_time_place_person_text: nullableString,
    course_type: nullableString,
    course_gradation: z.string(),
    course_category: z.string(),
    education_type: z.string(),
    class_type: z.string(),
    open_department: z.string(),
    description: z.string(),
    credit: numeric,
  }),
  lectures: z.object({
    course_id: integer,
    position: integer,
    start_date: integer,
    end_date: integer,
    name: z.string(),
    location: z.string(),
    teacher_name: z.string(),
    periods: numeric,
    start_index: integer,
    end_index: integer,
    start_hhmm: integer,
    end_hhmm: integer,
  }),
  exams: z.object({
    course_id: integer,
    position: integer,
    start_date: integer,
    end_date: integer,
    name: z.string(),
    location: z.string(),
    exam_type: z.string(),
    start_hhmm: integer,
    end_hhmm: integer,
    exam_mode: nullableString,
  }),
  busNotice: z.object({
    message: nullableString,
    url: nullableString,
  }),
  busCampuses: z.object({
    id: integer,
    name: z.string(),
    latitude: numeric,
    longitude: numeric,
  }),
  busRoutes: z.object({
    id: integer,
  }),
  busRouteStops: z.object({
    route_id: integer,
    stop_order: integer,
    campus_id: integer,
  }),
  busTrips: z.object({
    day_type: dayType,
    schedule_id: integer,
    route_id: integer,
    position: integer,
  }),
  busTripStopTimes: z.object({
    day_type: dayType,
    schedule_id: integer,
    position: integer,
    stop_order: integer,
    campus_id: integer,
    departure_time: nullableString,
  }),
} satisfies {
  [K in StaticSnapshotRowKind]: z.ZodType<StaticSnapshotRowsByKind[K]>;
};

function formatIssuePath(path: PropertyKey[]) {
  return path.length > 0 ? path.join(".") : "<row>";
}

export function validateStaticSnapshotRows<K extends StaticSnapshotRowKind>(
  kind: K,
  rows: unknown[],
): StaticSnapshotRowsByKind[K][] {
  const schema = rowSchemas[kind] as unknown as z.ZodType<
    StaticSnapshotRowsByKind[K]
  >;
  return rows.map((row, index) => {
    const result = schema.safeParse(row);
    if (result.success) {
      return result.data;
    }

    const details = result.error.issues
      .map((issue) => `${formatIssuePath(issue.path)}: ${issue.message}`)
      .join("; ");
    throw new Error(
      `Invalid static snapshot ${kind} row ${index + 1}: ${details}`,
    );
  });
}
