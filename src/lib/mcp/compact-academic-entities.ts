import { isRecord } from "@/lib/utils";
import {
  compactCampus,
  compactCourse,
  compactDepartment,
  compactSemester,
  compactTeacherTitle,
} from "./compact-base-entities";
import {
  compactArrayRelations,
  compactRelations,
  pick,
  transferScalarKeys,
} from "./compact-helpers";

export function compactTeacher(value: unknown) {
  if (!isRecord(value)) return value;
  return {
    ...pick(value, [
      "id",
      "personId",
      "teacherId",
      "code",
      "jwId",
      "nameCn",
      "nameEn",
      "namePrimary",
      "nameSecondary",
    ]),
    ...compactRelations(value, {
      department: compactDepartment,
      teacherTitle: compactTeacherTitle,
    }),
    ...transferScalarKeys(value, ["_count"]),
    ...compactArrayRelations(value, { sections: compactSection }),
  };
}

export function compactSection(value: unknown) {
  if (!isRecord(value)) return value;
  return {
    ...pick(value, [
      "id",
      "jwId",
      "code",
      "namePrimary",
      "nameSecondary",
      "campusId",
      "openDepartmentId",
    ]),
    ...compactRelations(value, {
      course: compactCourse,
      semester: compactSemester,
      campus: compactCampus,
      openDepartment: compactDepartment,
    }),
    ...compactArrayRelations(value, { teachers: compactTeacher }),
  };
}
