import { describe, expect, test } from "vitest";
import { localizeCompactSubscriptionSection } from "@/features/subscriptions/server/subscription-section-localize";

describe("localizeCompactSubscriptionSection", () => {
  test("adds localized name fields expected by subscription API schemas", () => {
    const section = localizeCompactSubscriptionSection(
      {
        id: 1,
        code: "CS101",
        course: {
          nameCn: "数值分析",
          nameEn: "Numerical Analysis",
        },
        campus: {
          nameCn: "西区",
          nameEn: "West Campus",
        },
        openDepartment: null,
        teachers: [{ nameCn: "张老师", nameEn: "Prof Zhang" }],
      },
      "zh-cn",
    );

    expect(section.course).toMatchObject({
      namePrimary: "数值分析",
      nameSecondary: "Numerical Analysis",
    });
    expect(section.campus).toMatchObject({
      namePrimary: "西区",
      nameSecondary: "West Campus",
    });
    expect(section.teachers[0]).toMatchObject({
      namePrimary: "张老师",
      nameSecondary: "Prof Zhang",
    });
  });
});
