import { beforeEach, describe, expect, it, vi } from "vitest";

const list = vi.hoisted(() => vi.fn());
vi.mock("@/features/calendar/server/calendar-events", () => ({
  listUserCalendarEvents: list,
}));

import { listPersonalCalendarPage } from "@/features/calendar/server/personal-calendar-page";

const at = "2035-09-15T10:00:00+08:00";
const endsAt = "2035-09-15T11:00:00+08:00";
beforeEach(() => vi.resetAllMocks());
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
        payload: { id: "todo", title: "Read" },
      },
      {
        type: "homework_due",
        at,
        endsAt: null,
        payload: { id: "hw", title: "Exercise" },
      },
      {
        type: "schedule",
        at,
        endsAt,
        payload: {
          id: 1,
          room: { nameCn: "东区" },
          section: { jwId: 2, course: { nameCn: "数学" } },
        },
      },
      {
        type: "exam",
        at,
        endsAt,
        payload: { id: 3, section: { course: { nameCn: "数学" } } },
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
    expect(result.data[0]).toEqual({
      id: "young-42",
      type: "young_event",
      youngId: "42",
      at,
      endsAt,
      title: "Workshop",
      location: "Lab",
      url: "/catalog/young-events/42",
    });
    expect(result.data[1].endsAt).toBeNull();
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
          room: null,
          section: { jwId: id, course: { nameCn: "课" } },
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
  });
  it("does not silently discard a source absent from the response contract", async () => {
    list.mockResolvedValue([{ type: "unsupported", at, endsAt }]);
    await expect(listPersonalCalendarPage("owner")).rejects.toThrow(
      "Unsupported calendar event type",
    );
  });
});
