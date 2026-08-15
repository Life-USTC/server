import { Prisma } from "@/generated/prisma/client";
import {
  localizedNamePrimary,
  localizedNameSecondary,
} from "@/lib/localized-name";

const localizedNameResult = (locale: string) => ({
  namePrimary: {
    needs: { nameCn: true, nameEn: true },
    compute: ({ nameCn, nameEn }: { nameCn: string; nameEn?: string | null }) =>
      localizedNamePrimary(locale, nameCn, nameEn),
  },
  nameSecondary: {
    needs: { nameCn: true, nameEn: true },
    compute: ({ nameCn, nameEn }: { nameCn: string; nameEn?: string | null }) =>
      localizedNameSecondary(locale, nameCn, nameEn),
  },
});

export const localizedNamesExtension = (locale: string) =>
  Prisma.defineExtension({
    name: "localizedNames",
    result: {
      adminClass: localizedNameResult(locale),
      busCampus: localizedNameResult(locale),
      busRoute: localizedNameResult(locale),
      building: localizedNameResult(locale),
      campus: localizedNameResult(locale),
      classType: localizedNameResult(locale),
      course: localizedNameResult(locale),
      courseCategory: localizedNameResult(locale),
      courseClassify: localizedNameResult(locale),
      courseGradation: localizedNameResult(locale),
      courseType: localizedNameResult(locale),
      department: localizedNameResult(locale),
      educationLevel: localizedNameResult(locale),
      examBatch: localizedNameResult(locale),
      examMode: localizedNameResult(locale),
      room: localizedNameResult(locale),
      roomType: localizedNameResult(locale),
      teacher: localizedNameResult(locale),
      teacherLessonType: localizedNameResult(locale),
      teacherTitle: localizedNameResult(locale),
      teachLanguage: localizedNameResult(locale),
    },
  });
