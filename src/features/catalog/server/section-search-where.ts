import { buildSectionOrderBy } from "@/features/catalog/server/section-search-order";
import { parseSectionSearchQuery } from "@/features/catalog/server/section-search-parser";
import type {
  ParsedSectionSearchQuery,
  SectionSearchConditionKey,
  SectionSearchOverrides,
} from "@/features/catalog/server/section-search-types";
import type { Prisma } from "@/generated/prisma/client";
import { ilike } from "@/lib/query-filter-helpers";

function localizedNameCondition(value: string) {
  return {
    OR: [{ nameCn: ilike(value) }, { nameEn: ilike(value) }],
  };
}

const SECTION_SEARCH_CONDITIONS: Array<{
  key: SectionSearchConditionKey;
  build: (value: string) => Prisma.SectionWhereInput | undefined;
}> = [
  {
    key: "teacher",
    build: (value) => ({
      teachers: { some: localizedNameCondition(value) },
    }),
  },
  { key: "courseCode", build: (value) => ({ course: { code: ilike(value) } }) },
  { key: "lectureCode", build: (value) => ({ code: ilike(value) }) },
  {
    key: "campus",
    build: (value) => ({ campus: localizedNameCondition(value) }),
  },
  {
    key: "credits",
    build: (value) => {
      const credits = Number(value);
      return Number.isFinite(credits) ? { credits } : undefined;
    },
  },
  {
    key: "department",
    build: (value) => ({
      openDepartment: localizedNameCondition(value),
    }),
  },
  {
    key: "semester",
    build: (value) => ({ semester: { nameCn: ilike(value) } }),
  },
  {
    key: "category",
    build: (value) => ({
      course: { category: localizedNameCondition(value) },
    }),
  },
  {
    key: "level",
    build: (value) => ({
      course: { educationLevel: localizedNameCondition(value) },
    }),
  },
  {
    key: "classType",
    build: (value) => ({
      course: { classType: localizedNameCondition(value) },
    }),
  },
];

function trimmedString(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function applySearchOverrides(
  parsed: ParsedSectionSearchQuery,
  overrides: SectionSearchOverrides,
): ParsedSectionSearchQuery {
  const teacher = trimmedString(overrides.teacher);
  const courseCode = trimmedString(overrides.courseCode);
  const lectureCode = trimmedString(overrides.sectionCode);
  const sort = trimmedString(overrides.sort);
  const requestedOrder = trimmedString(overrides.order)?.toLowerCase();
  const order =
    requestedOrder === "asc" || requestedOrder === "desc"
      ? requestedOrder
      : undefined;
  const credits =
    overrides.credits === null || overrides.credits === undefined
      ? undefined
      : trimmedString(String(overrides.credits));

  return {
    ...parsed,
    ...(teacher ? { teacher } : {}),
    ...(courseCode ? { courseCode } : {}),
    ...(lectureCode ? { lectureCode } : {}),
    ...(credits ? { credits } : {}),
    ...(sort ? { sort } : {}),
    ...(order ? { order } : {}),
  };
}

export function buildSectionSearchWhere(
  search?: string,
  overrides: SectionSearchOverrides = {},
): {
  where?: Prisma.SectionWhereInput;
  orderBy?: Prisma.SectionOrderByWithRelationInput;
} {
  const parsed = applySearchOverrides(
    parseSectionSearchQuery(search ?? ""),
    overrides,
  );
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
        {
          teachers: {
            some: localizedNameCondition(parsed.general),
          },
        },
      ],
    });
  }

  return {
    where: conditions.length > 0 ? { AND: conditions } : undefined,
    orderBy,
  };
}
