import type { Prisma } from "@/generated/prisma/client";

/**
 * Workspace subscription reads can run on Prisma's raw RLS transaction client,
 * so this projection contains database fields only. Localized computed names are
 * added after the query by `localizeCompactSubscriptionSection`.
 */
export const subscriptionSectionCompactInclude = {
  course: {
    include: {
      educationLevel: true,
      category: true,
      classify: true,
      classType: true,
      gradation: true,
      type: true,
    },
  },
  semester: true,
  campus: true,
  openDepartment: true,
  teachers: {
    select: {
      id: true,
      jwId: true,
      personId: true,
      code: true,
      nameCn: true,
      nameEn: true,
    },
  },
} satisfies Prisma.SectionInclude;
