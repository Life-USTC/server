import type { AppLocale } from "@/i18n/config";
import type { getPrisma } from "@/lib/db/prisma";
import { toLocalizedNameDto } from "@/lib/localized-name";

type Label = { nameCn: string; nameEn: string | null };
type Labels = Record<
  "campus" | "roomType" | "teachLanguage" | "examMode" | "openDepartment",
  Label | null
>;

export async function loadSectionPageLabels(
  db: ReturnType<typeof getPrisma>,
  jwId: number,
  locale: AppLocale,
) {
  const [labels] = await db.$queryRaw<Labels[]>`
    SELECT
      CASE WHEN campus.id IS NOT NULL THEN json_build_object('nameCn', campus."nameCn", 'nameEn', campus."nameEn") END AS "campus",
      CASE WHEN roomType.id IS NOT NULL THEN json_build_object('nameCn', roomType."nameCn", 'nameEn', roomType."nameEn") END AS "roomType",
      CASE WHEN teachLanguage.id IS NOT NULL THEN json_build_object('nameCn', teachLanguage."nameCn", 'nameEn', teachLanguage."nameEn") END AS "teachLanguage",
      CASE WHEN examMode.id IS NOT NULL THEN json_build_object('nameCn', examMode."nameCn", 'nameEn', examMode."nameEn") END AS "examMode",
      CASE WHEN openDepartment.id IS NOT NULL THEN json_build_object('nameCn', openDepartment."nameCn", 'nameEn', openDepartment."nameEn") END AS "openDepartment"
    FROM "Section" s
    LEFT JOIN "Campus" campus ON campus.id = s."campusId"
    LEFT JOIN "RoomType" roomType ON roomType.id = s."roomTypeId"
    LEFT JOIN "TeachLanguage" teachLanguage ON teachLanguage.id = s."teachLanguageId"
    LEFT JOIN "ExamMode" examMode ON examMode.id = s."examModeId"
    LEFT JOIN "Department" openDepartment ON openDepartment.id = s."openDepartmentId"
    WHERE s."jwId" = ${jwId}
  `;
  if (!labels) return null;
  const localized = (label: Label | null) =>
    label && toLocalizedNameDto(label, locale);
  return {
    campus: localized(labels.campus),
    roomType: localized(labels.roomType),
    teachLanguage: localized(labels.teachLanguage),
    examMode: localized(labels.examMode),
    openDepartment: localized(labels.openDepartment),
  };
}
