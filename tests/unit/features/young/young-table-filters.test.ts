import { describe, expect, it } from "vitest";
import { buildYoungEventListQuery } from "@/features/young/server/young-event-query";
import { parseYoungTableFilters } from "@/features/young/server/young-table-filter-schema";
import { matchTableFilter } from "@/lib/table-filters";

describe("Young Web table filters", () => {
  it("combines alternatives within fields and independent column predicates", () => {
    const tableFilters = parseYoungTableFilters(
      new URLSearchParams({
        module: "德,智",
        organizerId: "club-a,club-b",
        active: "true,false",
        search: "Workshop",
        location: "Hall",
        capacity: "20",
        capacityOp: "gte",
        appliedCount: "3",
        appliedCountOp: "between",
        appliedCountMax: "10",
      }),
      "events",
    );
    expect(buildYoungEventListQuery({ tableFilters }).where).toEqual({
      name: { contains: "Workshop", mode: "insensitive" },
      location: { contains: "Hall", mode: "insensitive" },
      module: { in: ["德", "智"] },
      organizerId: { in: ["club-a", "club-b"] },
      capacity: { gte: 20 },
      appliedCount: { gte: 3, lte: 10 },
    });
  });

  it("uses complete Shanghai calendar days for date comparisons", () => {
    const tableFilters = parseYoungTableFilters(
      new URLSearchParams({
        startAt: "2026-10-24",
        startAtOp: "between",
        startAtMax: "2026-10-25",
      }),
      "events",
    );
    expect(buildYoungEventListQuery({ tableFilters }).where).toEqual({
      startAt: {
        gte: new Date("2026-10-23T16:00:00.000Z"),
        lte: new Date("2026-10-25T15:59:59.999Z"),
      },
    });
  });

  it.each([
    ["events", "capacity", "20"],
    ["events", "startAt", "2026-10-24"],
    ["organizers", "activeCount", "20"],
  ] as const)(
    "treats an empty %s %s range as unrestricted",
    (kind, field, upper) => {
      for (const maximum of ["", upper]) {
        const tableFilters = parseYoungTableFilters(
          new URLSearchParams({
            search: "Workshop",
            [field]: "",
            [`${field}Op`]: "between",
            [`${field}Max`]: maximum,
          }),
          kind,
        );
        expect(tableFilters[field]).toBeUndefined();
        expect(tableFilters.search).toBe("Workshop");
        if (kind === "events") {
          expect(buildYoungEventListQuery({ tableFilters }).where).toEqual({
            name: { contains: "Workshop", mode: "insensitive" },
          });
        } else {
          expect(
            [0, 10, 100].filter((value) =>
              matchTableFilter(
                value,
                { name: field, label: field, type: "number" },
                tableFilters,
              ),
            ),
          ).toEqual([0, 10, 100]);
        }
      }
    },
  );

  it.each([
    "activeCount=10&activeCountOp=between",
    "activeCount=10&activeCountOp=between&activeCountMax=5",
  ])("rejects incomplete or reversed nonempty organizer range %s", (query) => {
    expect(() =>
      parseYoungTableFilters(new URLSearchParams(query), "organizers"),
    ).toThrow();
  });

  it.each([
    ["SIGNUP", true],
    ["Ended", false],
  ])(
    "matches displayed fallback status %s before pagination",
    (status, isActive) => {
      expect(
        buildYoungEventListQuery({
          tableFilters: { status, module: "智" },
          tableStatusLabels: {
            statusOpen: "Open for signup",
            statusClosed: "Ended",
          },
        }).where,
      ).toEqual({
        module: "智",
        OR: [
          { status: { contains: status, mode: "insensitive" } },
          { isActive, OR: [{ status: null }, { status: "" }] },
        ],
      });
    },
  );

  it("keeps raw upstream status matching when fallback labels do not match", () => {
    expect(
      buildYoungEventListQuery({
        tableFilters: { status: "审核中" },
        tableStatusLabels: { statusOpen: "报名中", statusClosed: "已结束" },
      }).where,
    ).toEqual({
      OR: [{ status: { contains: "审核中", mode: "insensitive" } }],
    });
  });

  it("preserves unrecognized upstream taxonomy values and deduplicates choices", () => {
    const tableFilters = parseYoungTableFilters(
      new URLSearchParams("module=新模块&module=智&module=智"),
      "events",
    );
    expect(buildYoungEventListQuery({ tableFilters }).where).toEqual({
      module: { in: ["新模块", "智"] },
    });
  });

  it("preserves category punctuation with native repeated parameters and scalar legacy URLs", () => {
    const categories = ["Research, advanced", "100%20 literal"];
    const tableFilters = parseYoungTableFilters(
      new URLSearchParams(categories.map((category) => ["category", category])),
      "events",
    );
    expect(tableFilters.category).toBe(
      "Research%2C%20advanced,100%2520%20literal",
    );
    expect(buildYoungEventListQuery({ tableFilters }).where).toEqual({
      category: { in: categories },
    });
    const category = categories[0];
    expect(
      buildYoungEventListQuery({
        tableFilters: parseYoungTableFilters(
          new URLSearchParams({ category }),
          "events",
        ),
      }).where,
    ).toEqual({ category });
    expect(buildYoungEventListQuery({ category }).where).toEqual({ category });
  });

  it.each([
    "capacity=-1",
    "capacity=Infinity",
    "capacity=1000000001",
    "capacityOp=execute",
    "capacity=10&capacityOp=between",
    "capacity=10&capacityOp=between&capacityMax=2",
    "startAt=2026-02-30",
    "startAt=2026-10-24&startAtOp=between",
    "startAt=2026-10-24&startAtOp=between&startAtMax=2026-10-23",
    "active=maybe",
    `module=${Array.from({ length: 51 }, (_, i) => i).join(",")}`,
    `category=${"x".repeat(101)}`,
    new URLSearchParams(
      Array.from({ length: 51 }, (_, i) => ["category", String(i)]),
    ).toString(),
  ])("rejects invalid or unbounded query %s", (query) => {
    expect(() =>
      parseYoungTableFilters(new URLSearchParams(query), "events"),
    ).toThrow();
  });

  it("does not include pagination or unknown query keys in the validated draft", () => {
    expect(
      parseYoungTableFilters(
        new URLSearchParams(
          "page=5&search=Club&historyCount=0&historyCountOp=eq&admin=true",
        ),
        "organizers",
      ),
    ).toEqual({ search: "Club", historyCount: "0", historyCountOp: "eq" });
  });

  it.each(["", "activity,registration", "registration,activity"])(
    "applies unrestricted Web time basis %s to either activity or registration dates",
    (timeBasis) => {
      expect(
        buildYoungEventListQuery({
          tableFilters: { timeBasis },
          dateUnknown: true,
        }).where,
      ).toEqual({
        AND: [{}, { OR: [{ startAt: null }, { applyStartAt: null }] }],
      });
      expect(
        buildYoungEventListQuery({
          tableFilters: { timeBasis },
          dateUnknown: false,
        }).where,
      ).toEqual({
        AND: [
          {},
          { OR: [{ startAt: { not: null } }, { applyStartAt: { not: null } }] },
        ],
      });
    },
  );

  it("keeps an explicit Web time basis and the existing API default distinct", () => {
    expect(
      buildYoungEventListQuery({
        tableFilters: { timeBasis: "registration" },
        timeBasis: "registration",
        dateUnknown: true,
      }).where,
    ).toEqual({ AND: [{}, { applyStartAt: null }] });
    expect(buildYoungEventListQuery({ dateUnknown: true }).where).toEqual({
      AND: [{}, { startAt: null }],
    });
  });
});
