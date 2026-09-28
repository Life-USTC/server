import { expect, test } from "vitest";
import {
  calendarExamDetail,
  calendarHomeworkChipFields,
  calendarHomeworkDetail,
  calendarSessionDetail,
  calendarTodoChipFields,
  calendarTodoDetail,
} from "@/features/workspace/lib/calendar-display-details";
import { timeSortValue } from "@/features/workspace/lib/calendar-display-helpers";
import { buildCalendarTimelineItemsForDay } from "@/features/workspace/lib/calendar-display-timeline";

test("deadline cards retain Shanghai time for equivalent timestamp offsets and midnight", () => {
  for (const [at, expected, sort] of [
    ["2026-04-29T12:00:00+08:00", "12:00", 1200],
    ["2026-04-29T04:00:00Z", "12:00", 1200],
    ["2026-04-29T16:30:00Z", "00:30", 30],
  ] as const) {
    const homework = { id: "homework", title: "Homework", submissionDueAt: at };
    const todo = { id: "todo", title: "Todo", dueAt: new Date(at) };
    expect(calendarHomeworkChipFields(homework).meta).toBe(expected);
    expect(calendarHomeworkDetail(homework)).toBe(expected);
    expect(calendarTodoChipFields(todo, "High").meta).toBe(expected);
    expect(calendarTodoDetail(todo, "High")).toBe(`${expected} · High`);
    expect(timeSortValue(at)).toBe(sort);
  }
});

test("the agenda orders timestamp deadlines alongside campus course and exam slots", () => {
  const items = buildCalendarTimelineItemsForDay(
    {
      sessions: [{ id: 1, courseName: "Class", startTime: 900, endTime: 1000 }],
      exams: [{ id: 2, courseName: "Exam", startTime: 1300, endTime: 1400 }],
      homeworks: [
        {
          id: "homework",
          title: "Homework",
          submissionDueAt: "2026-04-29T04:00:00Z",
        },
      ],
      todos: [{ id: "todo", title: "Todo", dueAt: "2026-04-29T07:00:00Z" }],
    },
    {
      courseLabel: "Course",
      examLabel: "Exam",
      homeworkLabel: "Homework",
      todoLabel: "Todo",
      examsHref: "/workspace/exams",
      todosHref: "/workspace/todos",
      sessionHref: () => "/catalog/sections/1",
      homeworkHref: () => "/catalog/sections/1#homework",
      sessionDetail: calendarSessionDetail,
      examDetail: calendarExamDetail,
      homeworkDetail: calendarHomeworkDetail,
      todoDetail: (todo) => calendarTodoDetail(todo, "High"),
    },
  );
  expect(items.map(({ key, sort }) => ({ key, sort }))).toEqual([
    { key: "session-1", sort: 900 },
    { key: "homework-homework", sort: 1200 },
    { key: "exam-2", sort: 1300 },
    { key: "todo-todo", sort: 1500 },
  ]);
});
