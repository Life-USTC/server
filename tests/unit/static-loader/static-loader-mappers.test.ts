import { describe, expect, it } from "vitest";
import { mapTeacherFromSchedule } from "@/static-loader/mappers";

describe("static schedule teacher mapping", () => {
  it("uses the upstream teacherId as jwId", () => {
    expect(
      mapTeacherFromSchedule({
        teacherId: 10915,
        personId: 210065,
        personName: "黄大弘",
      }),
    ).toEqual({ jwId: 10915, personId: 210065, nameCn: "黄大弘" });
  });
});
