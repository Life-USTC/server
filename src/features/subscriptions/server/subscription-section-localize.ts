import {
  type LocalizedName,
  namePrimary,
  nameSecondary,
} from "@/features/dashboard/lib/localized-names";
import type { AppLocale } from "@/i18n/config";

function withLocalizedNames<T extends LocalizedName>(
  entity: T,
  locale: AppLocale,
): T & { namePrimary: string; nameSecondary: string | null } {
  return {
    ...entity,
    namePrimary: namePrimary(entity),
    nameSecondary: nameSecondary(entity, locale),
  };
}

export function localizeCompactSubscriptionSection<
  T extends {
    campus: LocalizedName | null;
    course: LocalizedName | null;
    openDepartment: LocalizedName | null;
    teachers: LocalizedName[];
  },
>(section: T, locale: AppLocale) {
  return {
    ...section,
    course: section.course
      ? withLocalizedNames(section.course, locale)
      : section.course,
    campus: section.campus
      ? withLocalizedNames(section.campus, locale)
      : section.campus,
    openDepartment: section.openDepartment
      ? withLocalizedNames(section.openDepartment, locale)
      : section.openDepartment,
    teachers: section.teachers.map((teacher) =>
      withLocalizedNames(teacher, locale),
    ),
  };
}
