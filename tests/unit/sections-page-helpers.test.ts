import { describe, expect, it } from "vitest";
import {
  countDistinctSemesterIds,
  groupSectionsBySemester,
} from "@/features/subscriptions/lib/subscription-section-groups";

describe("sections page helpers", () => {
  it("groups sections by semester and sorts latest first", () => {
    const sections = [
      {
        id: 1,
        semester: {
          id: 1,
          nameCn: "2025 秋",
          startDate: new Date("2025-09-01T00:00:00.000Z"),
        },
      },
      {
        id: 2,
        semester: {
          id: 2,
          nameCn: "2026 春",
          startDate: new Date("2026-02-20T00:00:00.000Z"),
        },
      },
      {
        id: 3,
        semester: {
          id: 2,
          nameCn: "2026 春",
          startDate: new Date("2026-02-20T00:00:00.000Z"),
        },
      },
    ];

    const grouped = groupSectionsBySemester(sections);
    expect(grouped).toHaveLength(2);
    expect(grouped[0]?.label).toBe("2026 春");
    expect(grouped[0]?.sections).toHaveLength(2);
  });

  it("counts distinct semester ids across subscriptions", () => {
    const count = countDistinctSemesterIds([
      {
        sections: [{ semester: { id: 1 } }, { semester: { id: 2 } }],
      },
      {
        sections: [{ semester: { id: 2 } }, { semester: { id: null } }],
      },
    ]);

    expect(count).toBe(2);
  });
});
