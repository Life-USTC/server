import { afterEach, expect, it, vi } from "vitest";
import {
  pendingTodosForOverview,
  todosDueSoonForOverview,
  todosDueTodayForOverview,
  todosOverdueForOverview,
} from "@/features/workspace/lib/overview-filters";
import { computeHomeworkBuckets } from "@/features/workspace/server/workspace-homework-buckets";
import type { HomeworkWithSection } from "@/features/workspace/server/workspace-types";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";

afterEach(() => vi.unstubAllEnvs());
it("overview.homework-todo-layered", () => {
  const now = new Date("2035-09-15T00:15:00+08:00");
  const rows = [
    { id: "yesterday", dueAt: "2035-09-14T23:59:59+08:00", completed: false },
    { id: "today-start", dueAt: "2035-09-15T00:00:00+08:00", completed: false },
    { id: "today-end", dueAt: "2035-09-15T23:59:59+08:00", completed: false },
    { id: "tomorrow", dueAt: "2035-09-16T00:00:00+08:00", completed: false },
    { id: "third-day", dueAt: "2035-09-18T23:59:59+08:00", completed: false },
    { id: "fourth-day", dueAt: "2035-09-19T00:00:00+08:00", completed: false },
    { id: "undated", dueAt: null, completed: false },
    { id: "completed", dueAt: "2035-09-15T10:00:00+08:00", completed: true },
  ];
  const homeworks: HomeworkWithSection[] = rows.map((row) => ({
    id: row.id,
    sectionId: 1,
    title: row.id,
    publishedAt: null,
    submissionStartAt: null,
    submissionDueAt: row.dueAt ? new Date(row.dueAt) : null,
    homeworkCompletions: row.completed ? [{ completedAt: now }] : [],
    completionRequired: true,
    section: null,
  }));
  const source = {
    todos: rows,
    overview: { calendar: { referenceDate: now } },
  };
  const ids = (items: { id: string }[]) => items.map((item) => item.id);
  for (const timezone of ["UTC", "Asia/Shanghai", "America/Los_Angeles"]) {
    vi.stubEnv("TZ", timezone);
    const pending = pendingTodosForOverview(source);
    const homework = computeHomeworkBuckets(
      homeworks,
      shanghaiDayjs(now).startOf("day"),
      now,
    );
    expect(ids(pending)).toEqual(ids(homework.incompleteHomeworks));
    expect(ids(pending)).toEqual(
      rows.filter((row) => !row.completed).map((row) => row.id),
    );
    expect(ids(todosDueTodayForOverview(pending, source))).toEqual([
      "today-start",
      "today-end",
    ]);
    expect(ids(homework.dueToday)).toEqual(["today-start", "today-end"]);
    expect(ids(todosDueSoonForOverview(pending, source))).toEqual([
      "tomorrow",
      "third-day",
    ]);
    expect(ids(homework.dueWithin3Days)).toEqual(["tomorrow", "third-day"]);
    expect(ids(todosOverdueForOverview(pending, source))).toEqual([
      "yesterday",
    ]);
  }
});
