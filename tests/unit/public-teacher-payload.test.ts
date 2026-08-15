import { describe, expect, it } from "vitest";
import {
  courseDetailInclude,
  PUBLIC_DETAIL_SECTION_PREVIEW_LIMIT,
  sectionCompactInclude,
  sectionInclude,
  teacherAssignmentPublicSelect,
  teacherPublicDetailSelect,
  teacherPublicIdentitySelect,
  teacherPublicListSelect,
  teacherPublicReferenceSelect,
} from "@/features/catalog/server/academic-query-includes";
import { sectionBaseSchema } from "@/lib/api/schemas/academic-section-base-response-schemas";
import { sectionCompactSchema } from "@/lib/api/schemas/academic-section-list-response-schemas";
import { teacherListSchema } from "@/lib/api/schemas/academic-teacher-response-schemas";

const sourceOnlyTeacherFields = ["age", "postcode", "qq", "wechat"];
const teacherContactFields = ["email", "telephone", "mobile", "address"];

describe("public teacher payloads", () => {
  it("requires persisted section fields instead of treating drift as optional", () => {
    const section = Object.fromEntries(
      Object.keys(sectionBaseSchema.shape).map((key) => [key, null]),
    );
    expect(
      sectionBaseSchema.safeParse({
        ...section,
        id: 1,
        jwId: 2,
        code: "001",
        courseId: 3,
      }).success,
    ).toBe(true);
    const { retiredAt: _retiredAt, ...missingRetiredAt } = section;
    expect(
      sectionBaseSchema.safeParse({
        ...missingRetiredAt,
        id: 1,
        jwId: 2,
        code: "001",
        courseId: 3,
      }).success,
    ).toBe(false);
  });

  it("rejects nested count drift on teacher list payloads", () => {
    expect(
      teacherListSchema.shape._count.safeParse({ sections: 1, stale: true })
        .success,
    ).toBe(false);
  });

  it("uses an explicit identity allowlist for nested teacher references", () => {
    expect(Object.keys(teacherPublicIdentitySelect).sort()).toEqual(
      ["code", "id", "jwId", "nameCn", "nameEn", "personId"].sort(),
    );
    for (const field of [...sourceOnlyTeacherFields, ...teacherContactFields]) {
      expect(teacherPublicIdentitySelect).not.toHaveProperty(field);
      expect(teacherPublicReferenceSelect).not.toHaveProperty(field);
    }
  });

  it("accepts compact section teachers without private contact fields", () => {
    const teacher = sectionCompactSchema.shape.teachers.element.parse({
      id: 1,
      jwId: 9910101,
      personId: null,
      code: "T2401001",
      nameCn: "林老师",
      nameEn: "Professor Lin",
      namePrimary: "林老师",
      nameSecondary: "Professor Lin",
    });

    expect(teacher).not.toHaveProperty("email");
    expect(teacher).not.toHaveProperty("telephone");
    expect(teacher).not.toHaveProperty("mobile");
    expect(teacher).not.toHaveProperty("address");
  });

  it("never exposes source-only teacher fields on list or detail", () => {
    for (const select of [teacherPublicListSelect, teacherPublicDetailSelect]) {
      for (const field of sourceOnlyTeacherFields) {
        expect(select).not.toHaveProperty(field);
      }
    }
  });

  it("reuses narrow nested selects and bounds detail history", () => {
    expect(sectionCompactInclude.teachers).toEqual({
      select: teacherPublicIdentitySelect,
    });
    expect(sectionInclude.teachers).toEqual({
      select: teacherPublicIdentitySelect,
    });
    expect(courseDetailInclude.sections.take).toBe(
      PUBLIC_DETAIL_SECTION_PREVIEW_LIMIT,
    );
    expect(courseDetailInclude.sections.include.teachers).toEqual({
      select: teacherPublicIdentitySelect,
    });
    expect(teacherPublicDetailSelect.sections.take).toBe(
      PUBLIC_DETAIL_SECTION_PREVIEW_LIMIT,
    );
  });

  it("links assignments by teacherId and exposes the assignment title", () => {
    expect(teacherAssignmentPublicSelect.teacherId).toBe(true);
    expect(teacherAssignmentPublicSelect).not.toHaveProperty("teacher");
    expect(teacherAssignmentPublicSelect.teacherTitleId).toBe(true);
    expect(teacherAssignmentPublicSelect.teacherTitle).toEqual({
      select: expect.objectContaining({ id: true, jwId: true, code: true }),
    });
  });
});
