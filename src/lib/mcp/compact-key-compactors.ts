import { compactBusRoute, compactBusTrip } from "@/lib/mcp/compact-bus";
import { compactCalendarSubscription } from "@/lib/mcp/compact-calendar";
import {
  compactCampus,
  compactCourse,
  compactDepartment,
  compactExam,
  compactHomework,
  compactSchedule,
  compactSection,
  compactSemester,
  compactTeacher,
  compactTeacherTitle,
  compactTodo,
  compactUser,
} from "@/lib/mcp/compact-entities";
import { redactCalendarFeedLocation } from "@/lib/mcp/compact-helpers";

export const KEY_COMPACTORS: Record<string, (v: unknown) => unknown> = {
  calendarPath: (v) =>
    typeof v === "string" ? redactCalendarFeedLocation(v) : v,
  calendarUrl: (v) =>
    typeof v === "string" ? redactCalendarFeedLocation(v) : v,
  user: compactUser,
  course: compactCourse,
  semester: compactSemester,
  campus: compactCampus,
  openDepartment: compactDepartment,
  department: compactDepartment,
  teacherTitle: compactTeacherTitle,
  teacher: compactTeacher,
  todo: compactTodo,
  homework: compactHomework,
  schedule: compactSchedule,
  exam: compactExam,
  section: compactSection,
};

export const ARRAY_KEY_COMPACTORS: Record<string, (v: unknown) => unknown> = {
  todos: compactTodo,
  courses: compactCourse,
  sections: compactSection,
  teachers: compactTeacher,
  homeworks: compactHomework,
  schedules: compactSchedule,
  exams: compactExam,
  routes: compactBusRoute,
  trips: compactBusTrip,
  subscriptions: compactCalendarSubscription,
};

export const EVENT_PAYLOAD_COMPACTORS: Record<string, (v: unknown) => unknown> =
  {
    schedule: compactSchedule,
    homework_due: compactHomework,
    exam: compactExam,
    todo_due: compactTodo,
  };
