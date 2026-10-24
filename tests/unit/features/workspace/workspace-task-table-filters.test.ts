import { describe, expect, it } from "vitest";
import type {
  ExamRow,
  WorkspaceHomeworkItem,
  WorkspaceTodoItem,
} from "@/features/workspace/lib/workspace-controller-types";
import {
  examTableFields,
  filterExamTable,
  filterHomeworkTable,
  filterTodoTable,
  homeworkTableFields,
  todoTableFields,
} from "@/features/workspace/lib/workspace-task-table-filters";
import { getWorkspacePageCopy } from "@/lib/shell/page-copy";

const copy = getWorkspacePageCopy("en-us");
describe("Workspace table filters", () => {
  it("matches title, priority alternatives, completion and Shanghai due dates together", () => {
    const rows: WorkspaceTodoItem[] = [
      {
        id: "a",
        title: "Read A",
        priority: "high",
        completed: true,
        dueAt: "2026-10-23T16:30:00Z",
      },
      {
        id: "b",
        title: "Read B",
        priority: "low",
        completed: false,
        dueAt: "2026-10-24T10:00:00Z",
      },
      {
        id: "c",
        title: "Read C",
        priority: "medium",
        completed: false,
        dueAt: null,
      },
    ];
    const fields = todoTableFields(copy);
    expect(filterTodoTable(rows, fields, {}).map((row) => row.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(
      filterTodoTable(rows, fields, {
        title: "read",
        priority: "high,low",
        dueAt: "2026-10-24",
      }).map((row) => row.id),
    ).toEqual(["a", "b"]);
    expect(
      filterTodoTable(rows, fields, {
        completion: "incomplete",
        dueAt: "2026-10-24",
        dueAtOp: "gte",
      }).map((row) => row.id),
    ).toEqual(["b"]);
    expect(
      filterTodoTable(rows, fields, { completion: "completed,incomplete" }),
    ).toHaveLength(3);
  });

  it("keeps advisory completion semantics and supports course, semester and status badges", () => {
    const now = new Date("2026-10-24T10:00:00+08:00");
    const rows: WorkspaceHomeworkItem[] = [
      {
        id: "a",
        title: "Homework A",
        submissionDueAt: "2026-10-23",
        isMajor: true,
        section: { courseName: "Math", semesterName: "Fall" },
      },
      {
        id: "b",
        title: "Homework B",
        submissionDueAt: "2026-10-25",
        completionRequired: false,
        requiresTeam: true,
        section: { courseName: "Physics", semesterName: "Fall" },
      },
      {
        id: "c",
        title: "Homework C",
        submissionDueAt: "2026-10-23",
        completionRequired: false,
      },
    ];
    const fields = homeworkTableFields(copy, rows);
    expect(
      filterHomeworkTable(rows, fields, { completion: "incomplete" }, now).map(
        (row) => row.id,
      ),
    ).toEqual(["a", "b"]);
    expect(
      filterHomeworkTable(rows, fields, { completion: "advisory" }, now).map(
        (row) => row.id,
      ),
    ).toEqual(["b", "c"]);
    expect(
      filterHomeworkTable(
        rows,
        fields,
        { course: "Math,Physics", semester: "Fall", flags: "major,team" },
        now,
      ).map((row) => row.id),
    ).toEqual(["a", "b"]);
    expect(
      filterHomeworkTable(rows, fields, { completion: "overdue" }, now).map(
        (row) => row.id,
      ),
    ).toEqual(["a"]);
  });

  it("filters exam time, room alternatives, mode, and numeric attendance on full rows", () => {
    const base = {
      id: 1,
      courseName: "Calculus, Part A",
      dateKey: "2026-10-24",
      examDate: "2026-10-24",
      section: {
        code: "M.01",
        course: { nameCn: "Math" },
        exams: [],
        id: 1,
        jwId: 1,
        kind: "regular",
        teachers: [],
        semester: { nameCn: "Fall" },
      },
      startTime: 900,
      endTime: 1100,
      examMode: "Closed book",
      examType: 1,
      examBatch: { nameCn: "Final, B" },
      examTakeCount: 40,
      rooms: "101",
      completed: false,
    } satisfies ExamRow;
    const rows = [
      base,
      {
        ...base,
        id: 2,
        courseName: "Physics",
        examBatch: { nameCn: "Batch 1" },
        startTime: 1330,
        examTakeCount: 10,
        rooms: "102",
        completed: true,
      },
    ];
    const fields = examTableFields(copy, rows);
    expect(
      fields.find((field) => field.name === "examBatch")?.options,
    ).toContainEqual({
      value: "Final%2C%20B",
      label: "Final, B",
    });
    expect(
      filterExamTable(rows, fields, {
        course: "Calculus%2C%20Part%20A,Physics",
        examBatch: "Final%2C%20B",
      }).map((row) => row.id),
    ).toEqual([1]);
    expect(
      filterExamTable(rows, fields, {
        course: "Calculus%2C%20Part%20A,Physics",
        examBatch: "Final%2C%20B,Batch%201",
      }),
    ).toHaveLength(2);
    expect(
      filterExamTable(rows, fields, {
        rooms: "101,102",
        startTime: "12:00",
        startTimeOp: "lt",
        examTakeCount: "30",
        examTakeCountOp: "gte",
      }).map((row) => row.id),
    ).toEqual([1]);
    expect(
      filterExamTable(rows, fields, {
        completion: "completed",
        examMode: "Closed%20book",
      }).map((row) => row.id),
    ).toEqual([2]);
    expect(
      filterExamTable(rows, fields, {
        examTakeCount: "10",
        examTakeCountOp: "between",
        examTakeCountMax: "40",
      }),
    ).toHaveLength(2);
  });

  it("matches literal commas in homework course, semester and section choices", () => {
    const rows: WorkspaceHomeworkItem[] = [
      {
        id: "literal",
        title: "Homework A",
        submissionDueAt: null,
        section: {
          courseName: "Calculus, Part A",
          semesterName: "Fall, 2026",
          code: "CALC,01",
        },
      },
      {
        id: "other",
        title: "Homework B",
        submissionDueAt: null,
        section: {
          courseName: "Calculus",
          semesterName: "Fall",
          code: "CALC",
        },
      },
    ];
    const fields = homeworkTableFields(copy, rows);
    const values = {
      course: "Calculus%2C%20Part%20A",
      semester: "Fall%2C%202026",
      section: "CALC%2C01",
    };
    for (const [name, value] of Object.entries(values)) {
      expect(
        fields.find((field) => field.name === name)?.options,
      ).toContainEqual({
        value,
        label: decodeURIComponent(value),
      });
      expect(
        filterHomeworkTable(rows, fields, { [name]: value }, new Date()).map(
          (row) => row.id,
        ),
      ).toEqual(["literal"]);
    }
    expect(
      filterHomeworkTable(rows, fields, values, new Date()).map(
        (row) => row.id,
      ),
    ).toEqual(["literal"]);
  });
});
