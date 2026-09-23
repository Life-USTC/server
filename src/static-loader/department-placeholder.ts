import type {
  DepartmentBuild,
  DepartmentPlaceholderRequest,
  SectionBuild,
  TeacherBuild,
} from "./mappers";

export function collectCodeOnlyDepartmentPlaceholders(
  departments: readonly DepartmentBuild[],
  sections: readonly SectionBuild[],
  teachers: readonly TeacherBuild[],
): DepartmentPlaceholderRequest[] {
  const authoritativeCodes = new Set(
    departments.map((department) => department.code),
  );
  const placeholderCodes = new Set<string>();
  for (const section of sections) {
    if (
      section.openDepartmentCode &&
      !authoritativeCodes.has(section.openDepartmentCode)
    ) {
      placeholderCodes.add(section.openDepartmentCode);
    }
  }
  for (const teacher of teachers) {
    if (
      teacher.departmentCode &&
      !authoritativeCodes.has(teacher.departmentCode)
    ) {
      placeholderCodes.add(teacher.departmentCode);
    }
  }
  return [...placeholderCodes].sort().map((code) => ({ code, nameCn: code }));
}
