import { describe, expect, it } from "vitest";
import {
  type AdminClassOccurrence,
  canonicalizeAdminClasses,
} from "@/static-loader/admin-class-identity";

function occurrence(
  semesterCode: number,
  adminClass: AdminClassOccurrence["adminClass"],
): AdminClassOccurrence {
  return { semesterCode, adminClass };
}

describe("static admin class identity planning", () => {
  it("maps every historical jwId alias to the latest canonical build", () => {
    const plan = canonicalizeAdminClasses([
      occurrence(401, {
        jwId: 100,
        nameCn: "计算机科学与技术2024级1班",
      }),
      occurrence(421, {
        jwId: 200,
        nameCn: "计算机科学与技术2024级1班",
      }),
      occurrence(421, { jwId: 300, nameCn: "数学2024级1班" }),
    ]);

    expect(plan.canonicalBuilds).toEqual([
      { jwId: 200, nameCn: "计算机科学与技术2024级1班" },
      { jwId: 300, nameCn: "数学2024级1班" },
    ]);
    expect([...plan.canonicalJwIdByAlias]).toEqual([
      [100, 200],
      [200, 200],
      [300, 300],
    ]);
  });

  it("uses latest-semester metadata with historical non-empty fallback", () => {
    const plan = canonicalizeAdminClasses([
      occurrence(401, {
        jwId: 100,
        nameCn: "软件工程2024级1班",
        code: "OLD",
        grade: "2024",
        planCount: 30,
      }),
      occurrence(421, {
        jwId: 200,
        nameCn: "软件工程2024级1班",
        code: "NEW",
        stdCount: 28,
      }),
    ]);

    expect(plan.canonicalBuilds).toEqual([
      {
        jwId: 200,
        nameCn: "软件工程2024级1班",
        code: "NEW",
        grade: "2024",
        stdCount: 28,
        planCount: 30,
      },
    ]);
  });

  it("selects the most frequent real record within one semester", () => {
    const majority = occurrence(421, {
      jwId: 200,
      nameCn: "数学2024级1班",
      code: "B",
      stdCount: 30,
    });
    const minority = occurrence(421, {
      jwId: 100,
      nameCn: "数学2024级1班",
      code: "A",
      stdCount: 40,
    });

    expect(
      canonicalizeAdminClasses([majority, minority, majority]).canonicalBuilds,
    ).toEqual([majority.adminClass]);
  });

  it("breaks same-semester record ties deterministically and ignores input order", () => {
    const first = occurrence(421, {
      jwId: 200,
      nameCn: "物理2024级1班",
      code: "B",
      stdCount: 30,
    });
    const second = occurrence(421, {
      jwId: 100,
      nameCn: "物理2024级1班",
      code: "A",
      stdCount: 40,
    });

    const forward = canonicalizeAdminClasses([first, second]);
    const reverse = canonicalizeAdminClasses([second, first]);
    expect(forward).toEqual(reverse);
    expect(forward.canonicalBuilds).toEqual([second.adminClass]);
  });
});
