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
import { sectionCompactSchema } from "@/lib/api/schemas/academic-section-list-response-schemas";

const sourceOnlyTeacherFields = ["age", "postcode", "qq", "wechat"];
const teacherContactFields = ["email", "telephone", "mobile", "address"];

describe("public teacher payloads", () => {
  it("uses an explicit identity allowlist for nested teacher references", () => {
    expect(Object.keys(teacherPublicIdentitySelect).sort()).toEqual(
      [
        "code",
        "id",
        "jwId",
        "nameCn",
        "nameEn",
        "namePrimary",
        "nameSecondary",
        "personId",
      ].sort(),
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
