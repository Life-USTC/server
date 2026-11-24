import type { AppLocale } from "@/i18n/config";
import type { getPrisma } from "@/lib/db/prisma";
import { toLocalizedNameDto } from "@/lib/localized-name";

type ExamRow = {
  id: number;
  examDate: Date | null;
  startTime: number | null;
  endTime: number | null;
  examMode: string | null;
  examTakeCount: number | null;
  examBatch: { nameCn: string; nameEn: string | null } | null;
  examRooms: Array<{ room: string; count: number }>;
};

export async function loadSectionPageExams(
  db: ReturnType<typeof getPrisma>,
  jwId: number,
  locale: AppLocale,
) {
  const exams = await db.$queryRaw<ExamRow[]>`
    SELECT e.id, e."examDate", e."startTime", e."endTime", e."examMode", e."examTakeCount",
      CASE WHEN b.id IS NOT NULL THEN json_build_object(
        'nameCn', b."nameCn", 'nameEn', b."nameEn"
      ) END AS "examBatch",
      COALESCE((
        SELECT json_agg(json_build_object('room', r.room, 'count', r.count) ORDER BY r.id)
        FROM "ExamRoom" r WHERE r."examId" = e.id
      ), '[]'::json) AS "examRooms"
    FROM "Section" s
    JOIN "Exam" e ON e."sectionId" = s.id
    LEFT JOIN "ExamBatch" b ON b.id = e."examBatchId"
    WHERE s."jwId" = ${jwId}
    ORDER BY e."examDate", e."startTime"
  `;
  return exams.map((exam) => ({
    ...exam,
    examBatch: exam.examBatch && toLocalizedNameDto(exam.examBatch, locale),
  }));
}
