import { expect, test } from "vitest";
import {
  calendarExamChipFields,
  calendarExamDetail,
  calendarHomeworkChipFields,
  calendarSessionTimelineFields,
  calendarTodoChipFields,
} from "@/features/workspace/lib/calendar-display-details";
import { timeSortValue } from "@/features/workspace/lib/calendar-display-helpers";
import { buildCalendarTimelineItemsForDay } from "@/features/workspace/lib/calendar-display-timeline";

test("deadline cards retain Shanghai time for equivalent timestamp offsets and midnight", () => {
  for (const [at, expected, sort] of [
    ["2026-04-29T12:00:00+08:00", "12:00", 1200],
    ["2026-04-29T04:00:00Z", "12:00", 1200],
    ["2026-04-29T16:30:00Z", "00:30", 30],
  ] as const) {
    const homework = {
      id: "homework",
      title: "Homework",
      submissionDueAt: at,
      completionRequired: false,
      description: " Read\n chapter 2. ",
    };
    const todo = {
      id: "todo",
      title: "Todo",
      dueAt: new Date(at),
      content: " Bring\n notes. ",
    };
    expect(
      calendarHomeworkChipFields(homework, "No completion required"),
    ).toEqual({
      meta: expected,
      detail: "No completion required · Read chapter 2.",
    });
    expect(calendarTodoChipFields(todo, "High")).toEqual({
      meta: expected,
      detail: "High · Bring notes.",
    });
    expect(timeSortValue(at)).toBe(sort);
  }
});

test("the agenda orders timestamp deadlines alongside campus course and exam slots", () => {
  const items = buildCalendarTimelineItemsForDay(
    {
      sessions: [
        {
          id: 1,
          courseName: "Class",
          startTime: 900,
          endTime: 1000,
          sectionCode: "MATH.01",
          location: "Room 101 · East campus",
          teacherDisplay: "Teacher A、Teacher B",
        },
      ],
      exams: [
        {
          id: 2,
          courseName: "Exam",
          startTime: 1300,
          endTime: 1400,
          examMode: "Written",
          rooms: [
            { room: "A101", count: 30 },
            { room: "B202", count: 20 },
          ],
        },
      ],
      homeworks: [
        {
          id: "homework",
          title: "Homework",
          submissionDueAt: "2026-04-29T04:00:00Z",
          description: "Submit the problem set.",
        },
      ],
      todos: [
        {
          id: "todo",
          title: "Todo",
          dueAt: "2026-04-29T07:00:00Z",
          content: "Bring notes.",
        },
      ],
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
      sessionFields: calendarSessionTimelineFields,
      examFields: calendarExamChipFields,
      homeworkFields: calendarHomeworkChipFields,
      todoFields: (todo) => calendarTodoChipFields(todo, "High"),
    },
  );
  expect(
    items.map(({ key, sort, meta, detail }) => ({ key, sort, meta, detail })),
  ).toEqual([
    {
      key: "session-1",
      sort: 900,
      meta: "09:00-10:00",
      detail: "MATH.01 · Room 101 · East campus · Teacher A、Teacher B",
    },
    {
      key: "homework-homework",
      sort: 1200,
      meta: "12:00",
      detail: "Submit the problem set.",
    },
    {
      key: "exam-2",
      sort: 1300,
      meta: "13:00-14:00",
      detail: "Written · A101(30)、B202(20)",
    },
    {
      key: "todo-todo",
      sort: 1500,
      meta: "15:00",
      detail: "High · Bring notes.",
    },
  ]);
});

test("course and exam fields preserve partial intervals without inventing a start", () => {
  for (const [startTime, endTime, expected] of [
    [null, null, ""],
    [undefined, undefined, ""],
    [null, 1000, "10:00"],
    [900, null, "09:00"],
    [0, 30, "00:00-00:30"],
  ] as const) {
    const session = {
      id: 1,
      courseName: "Class",
      startTime,
      endTime,
      sectionCode: "MATH.01",
      location: "Room 101 · East campus",
      teacherDisplay: "Teacher A",
    };
    expect(calendarSessionTimelineFields(session)).toEqual({
      meta: expected,
      detail: "MATH.01 · Room 101 · East campus · Teacher A",
    });
    const exam = {
      id: 2,
      courseName: "Exam",
      startTime,
      endTime,
      examMode: "Written",
    };
    expect(calendarExamChipFields(exam)).toEqual({
      meta: expected,
      detail: "Written",
    });
    expect(calendarExamDetail(exam)).toBe(
      expected ? `${expected} · Written` : "Written",
    );
  }
});

test("undated deadlines retain context with an empty time", () => {
  expect(
    calendarHomeworkChipFields({
      id: "homework",
      title: "Homework",
      submissionDueAt: null,
      description: "Read chapter 2.",
    }),
  ).toEqual({ meta: "", detail: "Read chapter 2." });
  expect(
    calendarTodoChipFields(
      { id: "todo", title: "Todo", dueAt: null, content: "Bring notes." },
      "High",
    ),
  ).toEqual({ meta: "", detail: "High · Bring notes." });
  expect(timeSortValue(null)).toBe(2400);
});
