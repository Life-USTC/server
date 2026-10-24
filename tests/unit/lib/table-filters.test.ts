import { describe, expect, it } from "vitest";
import {
  matchTableFilter,
  type TableFilterField,
  tableFilterValues,
} from "@/lib/table-filters";

describe("table filter matching", () => {
  const number: TableFilterField = {
    name: "credits",
    label: "Credits",
    type: "number",
  };
  it.each([
    ["eq", [3]],
    ["ne", [0, 2.5, 4]],
    ["gt", [4]],
    ["gte", [3, 4]],
    ["lt", [0, 2.5]],
    ["lte", [0, 2.5, 3]],
    ["between", [3, 4]],
  ] as const)("compares numeric %s and excludes null", (operator, expected) => {
    const values = { credits: "3", creditsOp: operator, creditsMax: "4" };
    expect(
      [null, undefined, 0, 2.5, 3, 4].filter((value) =>
        matchTableFilter(value, number, values),
      ),
    ).toEqual(expected);
  });
  it("does not filter on empty values and does not match invalid comparisons", () => {
    expect(matchTableFilter(null, number, {})).toBe(true);
    const invalid: Record<string, string>[] = [
      { credits: "NaN" },
      { credits: "3", creditsOp: "unknown" },
      { credits: "3", creditsOp: "between" },
      { credits: "4", creditsOp: "between", creditsMax: "3" },
    ];
    for (const values of invalid) {
      expect(matchTableFilter(3, number, values)).toBe(false);
    }
  });
  it("matches selected values with OR, including any matching related value", () => {
    const field = {
      name: "campus",
      label: "Campus",
      options: [
        { value: "east", label: "East" },
        { value: "west", label: "West" },
      ],
    };
    expect(tableFilterValues(" east,west,east, ")).toEqual(["east", "west"]);
    expect(
      ["east", "west", "south"].filter((value) =>
        matchTableFilter(value, field, { campus: "east,west" }),
      ),
    ).toEqual(["east", "west"]);
    expect(matchTableFilter(["south", "west"], field, { campus: "west" })).toBe(
      true,
    );
    expect(matchTableFilter([], field, { campus: "west" })).toBe(false);
  });
  it("combines independent fields and matches text without case sensitivity", () => {
    const fields: TableFilterField[] = [
      number,
      { name: "name", label: "Name" },
    ];
    const filters = { credits: "3", creditsOp: "gte", name: "calc" };
    const rows = [
      { name: "Calculus", credits: 3 },
      { name: "CALCULUS II", credits: 2 },
      { name: "Algebra", credits: 4 },
    ];
    expect(
      rows.filter((row) =>
        fields.every((field) =>
          matchTableFilter(row[field.name as keyof typeof row], field, filters),
        ),
      ),
    ).toEqual([rows[0]]);
  });
  it("compares date and time values inclusively", () => {
    expect(
      matchTableFilter(
        "2026-10-24",
        { name: "date", label: "Date", type: "date" },
        { date: "2026-10-23", dateOp: "between", dateMax: "2026-10-24" },
      ),
    ).toBe(true);
    expect(
      matchTableFilter(
        "09:00",
        { name: "time", label: "Time", type: "time" },
        { time: "10:00", timeOp: "gte" },
      ),
    ).toBe(false);
  });
});
