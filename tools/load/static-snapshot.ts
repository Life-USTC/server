import { validateStaticSnapshotRows } from "./static-snapshot-validation";

export const STATIC_SCHEMA_VERSION = 2;

export type SqliteStatement = {
  get: (...params: unknown[]) => unknown;
  all: (...params: unknown[]) => unknown[];
};

export type SqliteDatabase = {
  query: (sql: string) => SqliteStatement;
  close: () => void;
};

const { Database } = require("bun:sqlite") as {
  Database: new (
    filename: string,
    options?: { readonly?: boolean },
  ) => SqliteDatabase;
};

export type SnapshotSemester = {
  id: string;
  name: string;
  start_date: number;
  end_date: number;
};

export type SnapshotCourse = {
  id: number;
  semester_id: string;
  name: string;
  course_code: string;
  lesson_code: string;
  teacher_name: string | null;
  date_time_place_person_text: string | null;
  course_type: string | null;
  course_gradation: string;
  course_category: string;
  education_type: string;
  class_type: string;
  open_department: string;
  description: string;
  credit: number;
};

export type SnapshotLecture = {
  course_id: number;
  position: number;
  start_date: number;
  end_date: number;
  name: string;
  location: string;
  teacher_name: string | null;
  periods: number;
  start_index: number;
  end_index: number;
  start_hhmm: number;
  end_hhmm: number;
};

export type SnapshotExam = {
  course_id: number;
  position: number;
  start_date: number;
  end_date: number;
  name: string;
  location: string;
  exam_type: string;
  start_hhmm: number;
  end_hhmm: number;
  exam_mode: string | null;
};

export type SnapshotBusNotice = {
  message: string | null;
  url: string | null;
};

export type SnapshotBusCampus = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
};

export type SnapshotBusRoute = {
  id: number;
};

export type SnapshotBusRouteStop = {
  route_id: number;
  stop_order: number;
  campus_id: number;
};

export type SnapshotBusTrip = {
  day_type: "weekday" | "weekend";
  schedule_id: number;
  route_id: number;
  position: number;
};

export type SnapshotBusTripStopTime = {
  day_type: "weekday" | "weekend";
  schedule_id: number;
  position: number;
  stop_order: number;
  campus_id: number;
  departure_time: string | null;
};

export class StaticSnapshot {
  private db: SqliteDatabase;
  private statementCache = new Map<string, SqliteStatement>();

  constructor(dbPath: string) {
    this.db = new Database(dbPath, { readonly: true });
  }

  close() {
    this.db.close();
  }

  private statement(sql: string) {
    let statement = this.statementCache.get(sql);
    if (!statement) {
      statement = this.db.query(sql);
      this.statementCache.set(sql, statement);
    }
    return statement;
  }

  private getOne<T>(sql: string, ...params: unknown[]) {
    return this.statement(sql).get(...params) as T | null;
  }

  private getAll<T>(sql: string, ...params: unknown[]) {
    return this.statement(sql).all(...params) as T[];
  }

  getMetadata(key: string) {
    const row = this.getOne<{ value: string }>(
      "SELECT value FROM metadata WHERE key = ?",
      key,
    );
    return row?.value ?? null;
  }

  assertSupportedSchema() {
    const schemaVersion = Number.parseInt(
      this.getMetadata("schema_version") ?? "",
      10,
    );
    if (schemaVersion !== STATIC_SCHEMA_VERSION) {
      throw new Error(
        `Unsupported static snapshot schema version: ${schemaVersion || "unknown"}`,
      );
    }
  }

  listSemesters() {
    return validateStaticSnapshotRows(
      "semesters",
      this.getAll(
        "SELECT id, name, start_date, end_date FROM semesters ORDER BY CAST(id AS INTEGER) DESC",
      ),
    );
  }

  listCoursesForSemester(semesterId: string) {
    return validateStaticSnapshotRows(
      "courses",
      this.getAll(
        `
      SELECT
        id,
        semester_id,
        name,
        course_code,
        lesson_code,
        teacher_name,
        date_time_place_person_text,
        course_type,
        course_gradation,
        course_category,
        education_type,
        class_type,
        open_department,
        description,
        credit
      FROM courses
      WHERE semester_id = ?
      ORDER BY lesson_code ASC, id ASC
      `,
        semesterId,
      ),
    );
  }

  listLecturesForSemester(semesterId: string) {
    return validateStaticSnapshotRows(
      "lectures",
      this.getAll(
        `
      SELECT
        lectures.course_id,
        lectures.position,
        lectures.start_date,
        lectures.end_date,
        lectures.name,
        lectures.location,
        lectures.teacher_name,
        lectures.periods,
        lectures.start_index,
        lectures.end_index,
        lectures.start_hhmm,
        lectures.end_hhmm
      FROM course_lectures AS lectures
      INNER JOIN courses ON courses.id = lectures.course_id
      WHERE courses.semester_id = ?
      ORDER BY lectures.course_id ASC, lectures.position ASC
      `,
        semesterId,
      ),
    );
  }

  listExamsForSemester(semesterId: string) {
    return validateStaticSnapshotRows(
      "exams",
      this.getAll(
        `
      SELECT
        exams.course_id,
        exams.position,
        exams.start_date,
        exams.end_date,
        exams.name,
        exams.location,
        exams.exam_type,
        exams.start_hhmm,
        exams.end_hhmm,
        exams.exam_mode
      FROM course_exams AS exams
      INNER JOIN courses ON courses.id = exams.course_id
      WHERE courses.semester_id = ?
      ORDER BY exams.course_id ASC, exams.position ASC
      `,
        semesterId,
      ),
    );
  }

  getBusNotice() {
    const row = this.getOne("SELECT message, url FROM bus_notice WHERE id = 1");
    return row ? validateStaticSnapshotRows("busNotice", [row])[0] : null;
  }

  listBusCampuses() {
    return validateStaticSnapshotRows(
      "busCampuses",
      this.getAll(
        "SELECT id, name, latitude, longitude FROM bus_campuses ORDER BY id ASC",
      ),
    );
  }

  listBusRoutes() {
    return validateStaticSnapshotRows(
      "busRoutes",
      this.getAll("SELECT id FROM bus_routes ORDER BY id ASC"),
    );
  }

  listBusRouteStops() {
    return validateStaticSnapshotRows(
      "busRouteStops",
      this.getAll(
        "SELECT route_id, stop_order, campus_id FROM bus_route_stops ORDER BY route_id ASC, stop_order ASC",
      ),
    );
  }

  listBusTrips(dayType: "weekday" | "weekend") {
    return validateStaticSnapshotRows(
      "busTrips",
      this.getAll(
        `
      SELECT day_type, schedule_id, route_id, position
      FROM bus_trips
      WHERE day_type = ?
      ORDER BY schedule_id ASC, position ASC
      `,
        dayType,
      ),
    );
  }

  listBusTripStopTimes(dayType: "weekday" | "weekend") {
    return validateStaticSnapshotRows(
      "busTripStopTimes",
      this.getAll(
        `
      SELECT day_type, schedule_id, position, stop_order, campus_id, departure_time
      FROM bus_trip_stop_times
      WHERE day_type = ?
      ORDER BY schedule_id ASC, position ASC, stop_order ASC
      `,
        dayType,
      ),
    );
  }
}
