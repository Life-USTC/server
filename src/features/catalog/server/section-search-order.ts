import type { Prisma } from "@/generated/prisma/client";

export function buildSectionOrderBy(
  sortField?: string,
  order: "asc" | "desc" = "asc",
): Prisma.SectionOrderByWithRelationInput | undefined {
  if (!sortField) return undefined;

  const sortMap: Record<string, Prisma.SectionOrderByWithRelationInput> = {
    credits: { credits: order },
    credit: { credits: order },
    capacity: { stdCount: order },
    semester: { semester: { jwId: order } },
    course: { course: { nameCn: order } },
    coursename: { course: { nameCn: order } },
    code: { code: order },
    sectioncode: { code: order },
    teacher: { teachers: { _count: order } },
    campus: { campus: { nameCn: order } },
  };

  return sortMap[sortField.toLowerCase()];
}
