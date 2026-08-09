import { describe, expect, it } from "vitest";
import { selectLatestAdminClasses } from "@/static-loader/admin-class-selection";
import { selectCampuses } from "@/static-loader/campus-selection";
import { selectLatestCourses } from "@/static-loader/course-selection";
import { collectCodeOnlyDepartmentPlaceholders } from "@/static-loader/department-placeholder";
import { selectLatestExamBatches } from "@/static-loader/exam-batch-selection";
import { mapExamBatch } from "@/static-loader/mappers";

describe("static direct upstream identity", () => {
  it("keeps distinct Course rows for distinct upstream IDs when names match", () => {
    const course = { jwId: 10, code: "MATH", nameCn: "数学" };
    expect(
      selectLatestCourses([
        { semesterCode: 401, course },
        { semesterCode: 401, course: { ...course, jwId: 11, code: "MATH-B" } },
      ]),
    ).toEqual([course, { ...course, jwId: 11, code: "MATH-B" }]);
  });

  it("selects latest Course metadata independent of snapshot order", () => {
    const oldCourse = { jwId: 10, code: "MATH", nameCn: "旧名" };
    const newCourse = { jwId: 10, code: "MATH", nameCn: "新名" };
    const occurrences = [
      { semesterCode: 401, course: oldCourse },
      { semesterCode: 421, course: newCourse },
    ];
    expect(selectLatestCourses(occurrences)).toEqual([newCourse]);
    expect(selectLatestCourses([...occurrences].reverse())).toEqual([
      newCourse,
    ]);
  });

  it("fails closed when one Course jwId maps to multiple codes", () => {
    expect(() =>
      selectLatestCourses([
        { semesterCode: 401, course: { jwId: 10, code: "A", nameCn: "课程" } },
        { semesterCode: 421, course: { jwId: 10, code: "B", nameCn: "课程" } },
      ]),
    ).toThrow("conflicting codes");
  });

  it("fails closed when one Course code maps to multiple jwIds", () => {
    expect(() =>
      selectLatestCourses([
        { semesterCode: 401, course: { jwId: 10, code: "A", nameCn: "甲" } },
        { semesterCode: 421, course: { jwId: 11, code: "A", nameCn: "乙" } },
      ]),
    ).toThrow("maps to multiple jwIds");
  });

  it("does not merge AdminClass rows by name and selects latest metadata", () => {
    const occurrences = [
      {
        semesterCode: 401,
        adminClass: { jwId: 1, code: "A", nameCn: "同名班级", stdCount: 20 },
      },
      {
        semesterCode: 421,
        adminClass: { jwId: 1, code: "A", nameCn: "同名班级", stdCount: 30 },
      },
      {
        semesterCode: 421,
        adminClass: { jwId: 2, code: "B", nameCn: "同名班级", stdCount: 25 },
      },
    ];
    expect(selectLatestAdminClasses(occurrences)).toEqual([
      occurrences[1].adminClass,
      occurrences[2].adminClass,
    ]);
    expect(selectLatestAdminClasses([...occurrences].reverse())).toEqual([
      occurrences[1].adminClass,
      occurrences[2].adminClass,
    ]);
  });

  it("fails closed when one AdminClass jwId maps to multiple codes", () => {
    expect(() =>
      selectLatestAdminClasses([
        {
          semesterCode: 401,
          adminClass: { jwId: 1, code: "A", nameCn: "班级" },
        },
        {
          semesterCode: 421,
          adminClass: { jwId: 1, code: "B", nameCn: "班级" },
        },
      ]),
    ).toThrow("conflicting codes");
  });

  it("preserves ExamBatch upstream id", () => {
    expect(mapExamBatch({ id: 77, name: "期末考试" })).toEqual({
      jwId: 77,
      nameCn: "期末考试",
    });
  });

  it("selects latest ExamBatch payload and rejects same-semester conflicts", () => {
    expect(
      selectLatestExamBatches([
        { semesterCode: 401, examBatch: { jwId: 77, nameCn: "旧批次" } },
        { semesterCode: 421, examBatch: { jwId: 77, nameCn: "新批次" } },
      ]),
    ).toEqual([{ jwId: 77, nameCn: "新批次" }]);
    expect(() =>
      selectLatestExamBatches([
        { semesterCode: 421, examBatch: { jwId: 77, nameCn: "甲" } },
        { semesterCode: 421, examBatch: { jwId: 77, nameCn: "乙" } },
      ]),
    ).toThrow("conflicting payloads");
  });

  it("rejects conflicting Campus payloads for one upstream id", () => {
    expect(() =>
      selectCampuses([
        { jwId: 9, nameCn: "东校区" },
        { jwId: 9, nameCn: "西校区" },
      ]),
    ).toThrow("conflicting metadata");
  });

  it("creates only code-only Department placeholders with null identity", () => {
    expect(
      collectCodeOnlyDepartmentPlaceholders(
        [{ jwId: 1, code: "AUTH", nameCn: "权威部门" }],
        [
          {
            jwId: 1,
            code: "S",
            courseJwId: 1,
            semesterCode: 421,
            openDepartmentCode: "REF",
          },
        ],
        [{ jwId: 2, nameCn: "教师", departmentCode: "AUTH" }],
      ),
    ).toEqual([{ code: "REF", nameCn: "REF" }]);
  });
});
