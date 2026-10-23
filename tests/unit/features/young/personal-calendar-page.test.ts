import { beforeEach, describe, expect, it, vi } from "vitest";

const { list, kinds } = vi.hoisted(() => ({ list: vi.fn(), kinds: vi.fn() }));
vi.mock("@/features/subscriptions/server/subscription-kind", () => ({
  getUserSubscriptionKinds: kinds,
}));
vi.mock("@/features/calendar/server/calendar-events", () => ({
  listUserCalendarEvents: list,
}));

import { listPersonalCalendarPage } from "@/features/calendar/server/personal-calendar-page";

const at = "2035-09-15T10:00:00+08:00";
const endsAt = "2035-09-15T11:00:00+08:00";
beforeEach(() => {
  vi.resetAllMocks();
  kinds.mockResolvedValue(new Map([[2, "teaching_assistant"]]));
});
describe("complete personal calendar page contract", () => {
  it("keeps every source type and its destination, without treating Young activities as todos", async () => {
    list.mockResolvedValue([
      {
        type: "young_event",
        at,
        endsAt,
        payload: { youngId: "42", name: "Workshop", location: "Lab" },
      },
      {
        type: "todo_due",
        at,
        endsAt: null,
        payload: {
          id: "todo",
          title: "Read",
          dueAt: new Date(at),
          priority: "high",
          content: "Chapter 2",
        },
      },
      {
        type: "homework_due",
        at,
        endsAt: null,
        payload: {
          id: "hw",
          title: "Exercise",
          submissionDueAt: new Date(at),
          sectionId: 2,
          section: { jwId: 2, code: "MATH" },
          completionRequired: false,
        },
      },
      {
        type: "schedule",
        at,
        endsAt,
        payload: {
          id: 1,
          sectionId: 2,
          startTime: 1000,
          customPlace: "Custom room",
          teacherParticipations: [{ teacher: { nameCn: "教师" } }],
          room: { nameCn: "东区" },
          section: { jwId: 2, code: "MATH", course: { nameCn: "数学" } },
        },
      },
      {
        type: "exam",
        at,
        endsAt,
        payload: {
          id: 3,
          sectionId: 2,
          startTime: null,
          examMode: "闭卷",
          examRooms: [{ room: "A" }, { room: "B" }],
          section: { jwId: 2, code: "MATH", course: { nameCn: "数学" } },
        },
      },
    ]);
    const result = await listPersonalCalendarPage("owner", {
      dateFrom: "2035-09-15",
      dateTo: "2035-09-15",
      locale: "zh-cn",
    });
    expect(result.data.map((row) => [row.type, row.url])).toEqual([
      ["young_event", "/catalog/young-events/42"],
      ["todo_due", "/workspace/todos"],
      ["homework_due", "/workspace/homeworks"],
      ["schedule", "/catalog/sections/2"],
      ["exam", "/workspace/exams"],
    ]);
    expect(result.data[0]).toMatchObject({
      id: "young-42",
      type: "young_event",
      youngId: "42",
      at,
      endsAt,
      title: "Workshop",
      location: "Lab",
      url: "/catalog/young-events/42",
    });
    expect(result.data[1]).toMatchObject({
      endsAt: null,
      priority: "high",
      content: "Chapter 2",
      target: { kind: "todo", id: "todo" },
    });
    expect(result.data[2]).toMatchObject({
      completionRequired: false,
      subscriptionKind: "teaching_assistant",
      target: { kind: "homework", id: "hw" },
    });
    expect(result.data[3]).toMatchObject({
      location: "Custom room",
      teachers: ["教师"],
      target: { kind: "section", id: "2" },
    });
    expect(result.data[4]).toMatchObject({
      location: "A · B",
      examMode: "闭卷",
      hasTime: false,
      target: { kind: "exam", id: "3" },
    });
    expect(list).toHaveBeenCalledWith(
      "owner",
      expect.objectContaining({ locale: "zh-cn" }),
    );
  });
  it("pages the complete result and preserves missing locations", async () => {
    list.mockResolvedValue(
      Array.from({ length: 101 }, (_, id) => ({
        type: "schedule",
        at,
        endsAt,
        payload: {
          id,
          sectionId: id,
          startTime: 1000,
          customPlace: null,
          teacherParticipations: [],
          room: null,
          section: { jwId: id, code: "COURSE", course: { nameCn: "课" } },
        },
      })),
    );
    const result = await listPersonalCalendarPage("owner", {
      page: 2,
      pageSize: 100,
    });
    expect(result.pagination).toEqual({
      page: 2,
      pageSize: 100,
      total: 101,
      totalPages: 2,
    });
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      location: null,
      youngId: null,
      url: "/catalog/sections/100",
    });
  });
  it("rejects invalid date ranges before querying owner state", async () => {
    await expect(
      listPersonalCalendarPage("owner", {
        dateFrom: "2035-09-16",
        dateTo: "2035-09-15",
      }),
    ).rejects.toThrow();
    expect(list).not.toHaveBeenCalled();
    expect(kinds).not.toHaveBeenCalled();
  });
  it("does not silently discard a source absent from the response contract", async () => {
    list.mockResolvedValue([{ type: "unsupported", at, endsAt }]);
    await expect(listPersonalCalendarPage("owner")).rejects.toThrow(
      "Unsupported calendar event type",
    );
  });
});
