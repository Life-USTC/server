import type { Prisma } from "@/generated/prisma/client";
import { ilike } from "@/lib/query-filter-helpers";

type TeacherSearchInput = {
  departmentId?: number | string;
  search?: string;
};

function parseTeacherDepartmentId(value: TeacherSearchInput["departmentId"]) {
  if (typeof value === "number") {
    return Number.isInteger(value) ? value : null;
  }
  if (!value) return null;

  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

export function buildTeacherWhere(input: TeacherSearchInput) {
  const where: Prisma.TeacherWhereInput = {};
  const departmentId = parseTeacherDepartmentId(input.departmentId);

  if (departmentId !== null) {
    where.departmentId = departmentId;
  }

  if (input.search) {
    where.OR = [
      { nameCn: ilike(input.search) },
      { nameEn: ilike(input.search) },
      { code: ilike(input.search) },
    ];
  }

  return where;
}
