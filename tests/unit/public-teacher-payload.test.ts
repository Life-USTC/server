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

  it("links assignments by teacherId without duplicating teacher rows", () => {
    expect(teacherAssignmentPublicSelect.teacherId).toBe(true);
    expect(teacherAssignmentPublicSelect).not.toHaveProperty("teacher");
    expect(teacherAssignmentPublicSelect).not.toHaveProperty("teacherTitle");
  });
});
