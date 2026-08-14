import { selectCurrentSemesterFromList } from "@/features/catalog/lib/current-semester";
import { withUserDbContext } from "@/lib/db/prisma";
import type { WorkspaceNavigationSummary } from "@/lib/shell/shell-bootstrap";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";

type WorkspaceNavigationCountRow = {
  calendar_items_count: bigint;
  exams_count: bigint;
  pending_homeworks_count: bigint;
  pending_todos_count: bigint;
  subscribed_section_count: bigint;
};

export async function getWorkspaceNavigationSummary(
  userId: string,
  referenceDate: Date = new Date(),
): Promise<WorkspaceNavigationSummary> {
  const referenceNow = shanghaiDayjs(referenceDate);
  const todayStart = referenceNow.startOf("day").toDate();
  const tomorrowStart = referenceNow.add(1, "day").startOf("day").toDate();

  return withUserDbContext(userId, async (tx) => {
    const semesters = await tx.semester.findMany({
      select: { id: true, startDate: true, endDate: true },
      orderBy: { startDate: "asc" },
    });
    const currentSemester = selectCurrentSemesterFromList(
      semesters,
      referenceDate,
    );
    const semesterStart = currentSemester?.startDate
      ? shanghaiDayjs(currentSemester.startDate).startOf("day").toDate()
      : referenceNow.subtract(6, "month").startOf("day").toDate();
    const semesterEnd = currentSemester?.endDate
      ? shanghaiDayjs(currentSemester.endDate).endOf("day").toDate()
      : referenceNow.add(6, "month").endOf("day").toDate();
    const currentSemesterId = currentSemester?.id ?? null;
    const nowHHmm = referenceNow.hour() * 100 + referenceNow.minute();

    const [row] = await tx.$queryRaw<WorkspaceNavigationCountRow[]>`
      WITH subscribed_sections AS (
        SELECT
          subscription."sectionId",
          section."semesterId",
          section."retiredAt"
        FROM "UserSectionSubscription" AS subscription
        INNER JOIN "Section" AS section
          ON section.id = subscription."sectionId"
        WHERE subscription."userId" = ${userId}
      ),
      active_sections AS (
        SELECT "sectionId", "semesterId"
        FROM subscribed_sections
        WHERE "retiredAt" IS NULL
      ),
      current_semester_sections AS (
        SELECT "sectionId"
        FROM active_sections
        WHERE "semesterId" = ${currentSemesterId}
      )
      SELECT
        (SELECT count(*) FROM subscribed_sections)
          AS subscribed_section_count,
        (
          SELECT count(*)
          FROM "Todo" AS todo
          WHERE todo."userId" = ${userId}
            AND NOT todo.completed
        ) AS pending_todos_count,
        (
          SELECT count(*)
          FROM "Homework" AS homework
          WHERE homework."deletedAt" IS NULL
            AND homework."sectionId" IN (
              SELECT "sectionId" FROM active_sections
            )
            AND NOT EXISTS (
              SELECT 1
              FROM "HomeworkCompletion" AS completion
              WHERE completion."homeworkId" = homework.id
                AND completion."userId" = ${userId}
            )
        ) AS pending_homeworks_count,
        (
          SELECT count(*)
          FROM "Exam" AS exam
          WHERE exam."sectionId" IN (
              SELECT "sectionId" FROM active_sections
            )
            AND (
              exam."examDate" >= ${tomorrowStart}
              OR (
                exam."examDate" >= ${todayStart}
                AND exam."examDate" < ${tomorrowStart}
                AND (
                  (exam."endTime" IS NULL AND exam."startTime" IS NULL)
                  OR exam."endTime" >= ${nowHHmm}
                  OR (
                    exam."endTime" IS NULL
                    AND exam."startTime" >= ${nowHHmm}
                  )
                )
              )
            )
        ) AS exams_count,
        (
          (
            SELECT count(*)
            FROM "Schedule" AS schedule
            WHERE schedule."sectionId" IN (
                SELECT "sectionId" FROM current_semester_sections
              )
              AND schedule.date >= ${semesterStart}
              AND schedule.date <= ${semesterEnd}
          )
          + (
            SELECT count(*)
            FROM "Exam" AS exam
            WHERE exam."sectionId" IN (
                SELECT "sectionId" FROM current_semester_sections
              )
              AND (
                exam."examDate" IS NOT NULL
                OR exam."startTime" IS NOT NULL
                OR exam."endTime" IS NOT NULL
                OR exam."examType" IS NOT NULL
                OR exam."examTakeCount" IS NOT NULL
                OR exam."examMode" IS NOT NULL
                OR EXISTS (
                  SELECT 1
                  FROM "ExamRoom" AS room
                  WHERE room."examId" = exam.id
                    AND (room.room <> '' OR room.count > 0)
                )
              )
          )
          + (
            SELECT count(*)
            FROM "Homework" AS homework
            WHERE homework."deletedAt" IS NULL
              AND homework."sectionId" IN (
                SELECT "sectionId" FROM current_semester_sections
              )
              AND homework."submissionDueAt" >= ${semesterStart}
              AND homework."submissionDueAt" <= ${semesterEnd}
              AND NOT EXISTS (
                SELECT 1
                FROM "HomeworkCompletion" AS completion
                WHERE completion."homeworkId" = homework.id
                  AND completion."userId" = ${userId}
              )
          )
          + (
            SELECT count(*)
            FROM "Todo" AS todo
            WHERE todo."userId" = ${userId}
              AND NOT todo.completed
              AND todo."dueAt" >= ${semesterStart}
              AND todo."dueAt" <= ${semesterEnd}
          )
        ) AS calendar_items_count
    `;

    if (!row) {
      throw new Error("Workspace navigation summary query returned no row");
    }

    return {
      userId,
      calendarItemsCount: Number(row.calendar_items_count),
      examsCount: Number(row.exams_count),
      pendingHomeworksCount: Number(row.pending_homeworks_count),
      pendingTodosCount: Number(row.pending_todos_count),
      subscribedSectionCount: Number(row.subscribed_section_count),
    };
  });
}
