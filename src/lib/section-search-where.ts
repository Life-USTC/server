import type { Prisma } from "@/generated/prisma/client";
import { ilike } from "@/lib/query-filter-helpers";
import { buildSectionOrderBy } from "@/lib/section-search-order";
import { parseSectionSearchQuery } from "@/lib/section-search-parser";
import type { SectionSearchConditionKey } from "@/lib/section-search-types";

const SECTION_SEARCH_CONDITIONS: Array<{
  key: SectionSearchConditionKey;
  build: (value: string) => Prisma.SectionWhereInput | undefined;
}> = [
  {
    key: "teacher",
    build: (value) => ({ teachers: { some: { nameCn: ilike(value) } } }),
  },
  { key: "courseCode", build: (value) => ({ course: { code: ilike(value) } }) },
  { key: "lectureCode", build: (value) => ({ code: ilike(value) }) },
  { key: "campus", build: (value) => ({ campus: { nameCn: ilike(value) } }) },
  {
    key: "credits",
    build: (value) => {
      const credits = Number(value);
      return Number.isFinite(credits) ? { credits } : undefined;
    },
  },
  {
    key: "department",
    build: (value) => ({ openDepartment: { nameCn: ilike(value) } }),
  },
  {
    key: "semester",
    build: (value) => ({ semester: { nameCn: ilike(value) } }),
  },
  {
    key: "category",
    build: (value) => ({ course: { category: { nameCn: ilike(value) } } }),
  },
  {
    key: "level",
    build: (value) => ({
      course: { educationLevel: { nameCn: ilike(value) } },
    }),
  },
  {
    key: "classType",
    build: (value) => ({ course: { classType: { nameCn: ilike(value) } } }),
  },
];

export function buildSectionSearchWhere(search?: string): {
  where?: Prisma.SectionWhereInput;
  orderBy?: Prisma.SectionOrderByWithRelationInput;
} {
  if (!search) {
    return {};
  }

  const parsed = parseSectionSearchQuery(search);
  const orderBy = buildSectionOrderBy(parsed.sort, parsed.order || "asc");
  const conditions = SECTION_SEARCH_CONDITIONS.flatMap((field) => {
    const value = parsed[field.key];
    const condition = value ? field.build(value) : undefined;
    return condition ? [condition] : [];
  });

  if (parsed.general) {
    conditions.push({
      OR: [
        {
          course: {
            nameCn: ilike(parsed.general),
          },
        },
        {
          course: {
            nameEn: ilike(parsed.general),
          },
        },
        {
          course: {
            code: ilike(parsed.general),
          },
        },
        {
          code: ilike(parsed.general),
        },
      ],
    });
  }

  return {
    where: conditions.length > 0 ? { AND: conditions } : undefined,
    orderBy,
  };
}
