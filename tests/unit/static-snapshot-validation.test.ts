import { describe, expect, it } from "vitest";
import { validateStaticSnapshotRows } from "../../tools/load/static-snapshot-validation";

describe("static snapshot row validation", () => {
  it("accepts valid course rows", () => {
    expect(
      validateStaticSnapshotRows("courses", [
        {
          id: 1,
          semester_id: "401",
          name: "数学分析",
          course_code: "MATH1001",
          lesson_code: "001",
          teacher_name: "张伟",
          date_time_place_person_text: null,
          course_type: "专业基础课",
          course_gradation: "本科",
          course_category: "专业课",
          education_type: "本科生",
          class_type: "理论",
          open_department: "数学科学学院",
          description: "",
          credit: 4,
        },
      ]),
    ).toEqual([
      {
        id: 1,
        semester_id: "401",
        name: "数学分析",
        course_code: "MATH1001",
        lesson_code: "001",
        teacher_name: "张伟",
        date_time_place_person_text: null,
        course_type: "专业基础课",
        course_gradation: "本科",
        course_category: "专业课",
        education_type: "本科生",
        class_type: "理论",
        open_department: "数学科学学院",
        description: "",
        credit: 4,
      },
    ]);
  });

  it("reports missing static course fields before import helpers run", () => {
    expect(() =>
      validateStaticSnapshotRows("courses", [
        {
          id: 1,
          semester_id: "401",
          name: "数学分析",
          course_code: "MATH1001",
          lesson_code: "001",
          teacher_name: "张伟",
          date_time_place_person_text: null,
          course_type: "专业基础课",
          course_gradation: "本科",
          course_category: "专业课",
          education_type: "本科生",
          class_type: null,
          open_department: "数学科学学院",
          description: "",
          credit: 4,
        },
      ]),
    ).toThrow(/Invalid static snapshot courses row 1: class_type:/);
  });

  it("reports malformed bus row enums with row context", () => {
    expect(() =>
      validateStaticSnapshotRows("busTrips", [
        {
          day_type: "holiday",
          schedule_id: 1,
          route_id: 2,
          position: 0,
        },
      ]),
    ).toThrow(/Invalid static snapshot busTrips row 1: day_type:/);
  });
});
