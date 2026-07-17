import { describe, expect, it } from "vitest";
import { canonicalizeAdminClasses } from "@/static-loader/admin-class-identity";

describe("static admin class identity planning", () => {
  it("maps every same-name jwId alias to one canonical build", () => {
    const plan = canonicalizeAdminClasses([
      { jwId: 200, nameCn: "计算机科学与技术2024级1班" },
      { jwId: 100, nameCn: "计算机科学与技术2024级1班" },
      { jwId: 300, nameCn: "数学2024级1班" },
    ]);

    expect(plan.canonicalBuilds).toEqual([
      { jwId: 100, nameCn: "计算机科学与技术2024级1班" },
      { jwId: 300, nameCn: "数学2024级1班" },
    ]);
    expect([...plan.canonicalJwIdByAlias]).toEqual([
      [100, 100],
      [200, 100],
      [300, 300],
    ]);
  });

  it("is stable when snapshot rows arrive in a different order", () => {
    const first = { jwId: 200, nameCn: "软件工程2024级1班" };
    const second = { jwId: 100, nameCn: "软件工程2024级1班" };

    expect(canonicalizeAdminClasses([first, second])).toEqual(
      canonicalizeAdminClasses([second, first]),
    );
  });
});
