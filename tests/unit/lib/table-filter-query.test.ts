import { describe, expect, it } from "vitest";
import {
  dateTableFilter,
  numberTableFilter,
  tableFilterPageHref,
  tableFilterParams,
} from "@/lib/table-filter-query";

describe("table filter queries", () => {
  it.each([
    ["eq", { equals: 3.5 }],
    ["ne", { not: 3.5 }],
    ["gt", { gt: 3.5 }],
    ["gte", { gte: 3.5 }],
    ["lt", { lt: 3.5 }],
    ["lte", { lte: 3.5 }],
    ["between", { gte: 3.5, lte: 8 }],
  ])(
    "supports numeric %s without rounding decimal values",
    (operator, expected) => {
      expect(
        numberTableFilter(
          { size: "3.5", sizeOp: operator as string, sizeMax: "8" },
          "size",
        ),
      ).toEqual(expected);
    },
  );
  it("keeps invalid numeric input empty while allowing an absent filter", () => {
    expect(
      numberTableFilter({ size: "", sizeOp: "between" }, "size"),
    ).toBeUndefined();
    for (const values of [
      { size: "Infinity" },
      { size: "no" },
      { size: "4", sizeOp: "invalid" },
      { size: "4", sizeOp: "between" },
      { size: "4", sizeOp: "between", sizeMax: "3" },
    ]) {
      expect(numberTableFilter(values, "size")).toEqual({ gt: 0, lt: 0 });
    }
  });
  it("uses the complete Shanghai day and includes the final range day", () => {
    expect(dateTableFilter({ createdAt: "2026-10-24" }, "createdAt")).toEqual({
      gte: new Date("2026-10-23T16:00:00Z"),
      lt: new Date("2026-10-24T16:00:00Z"),
    });
    expect(
      dateTableFilter(
        {
          createdAt: "2026-10-24",
          createdAtOp: "between",
          createdAtMax: "2026-10-26",
        },
        "createdAt",
      ),
    ).toEqual({
      gte: new Date("2026-10-23T16:00:00Z"),
      lt: new Date("2026-10-26T16:00:00Z"),
    });
    expect(
      dateTableFilter(
        { createdAt: "2026-10-24", createdAtOp: "gt" },
        "createdAt",
      ),
    ).toEqual({ gte: new Date("2026-10-24T16:00:00Z") });
    expect(
      dateTableFilter(
        { createdAt: "2026-10-24", createdAtOp: "ne" },
        "createdAt",
      ),
    ).toEqual({
      not: {
        gte: new Date("2026-10-23T16:00:00Z"),
        lt: new Date("2026-10-24T16:00:00Z"),
      },
    });
  });
  it("rejects impossible dates, timestamps and reversed date ranges", () => {
    for (const values of [
      { day: "2026-02-30" },
      { day: "2026-10-24T00:00:00Z" },
      { day: "2026-10-24", dayOp: "between", dayMax: "2026-10-23" },
    ]) {
      expect(dateTableFilter(values, "day")).toEqual({
        gt: new Date(0),
        lt: new Date(0),
      });
    }
  });
  it("preserves every filter and comparison while moving or resetting the page", () => {
    const filters = {
      role: "admin,user",
      size: "3.5",
      sizeOp: "between",
      sizeMax: "5",
      search: "数学 & 统计",
    };
    const next = new URL(
      tableFilterPageHref("/admin/users", filters, 2),
      "https://example.test",
    );
    expect(next.searchParams.get("page")).toBe("2");
    expect(tableFilterParams(next, Object.keys(filters))).toEqual(filters);
    const first = new URL(
      tableFilterPageHref(next.pathname, { ...filters, page: "2" }, 1),
      next,
    );
    expect(first.searchParams.has("page")).toBe(false);
    expect(tableFilterParams(first, Object.keys(filters))).toEqual(filters);
  });
});
