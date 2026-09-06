import { selectCurrentSemesterFromList } from "@/features/catalog/lib/current-semester";
import { Prisma } from "@/generated/prisma/client";
import { withUserDbContext } from "@/lib/db/prisma";
import type { WorkspaceNavigationSummary } from "@/lib/shell/shell-bootstrap";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";
import {
  countWorkspaceStageQuery,
  type WorkspaceStageCounter,
} from "./workspace-stage-analytics";

type NavigationSemester = {
  endDate: Date | null;
  id: number;
  startDate: Date | null;
};

export type WorkspaceNavigationSection = {
  id: number;
  retiredAt?: Date | null;
  semesterId: number | null;
};

export type WorkspaceNavigationAggregate = {
  calendarItemsCount: number;
  examsCount: number;
  highlightPendingHomeworks: boolean;
  pendingHomeworksCount: number;
  pendingTodosCount: number;
  subscribedSectionCount: number;
};

type WorkspaceNavigationCountRow = {
  calendar_items_count: bigint;
  exams_count: bigint;
  highlight_pending_homeworks: boolean;
  pending_homeworks_count: bigint;
  pending_todos_count: bigint;
  subscribed_section_count: bigint;
};

type AggregateOptions = {
  /** Already loaded by the workspace shell; avoids a second subscription read. */
  activeSections?: readonly WorkspaceNavigationSection[];
  /** Already loaded by the workspace shell; avoids a second semester read. */
  semesters?: readonly NavigationSemester[];
  /** The workspace todo tab already derives this count from its loaded rows. */
  skipPendingTodosCount?: boolean;
  stageCounter?: WorkspaceStageCounter;
};

function sectionIdsSql(ids: readonly number[]) {
  if (ids.length === 0) {
    return Prisma.sql`SELECT NULL::int AS "sectionId" WHERE FALSE`;
  }
  return Prisma.sql`
    SELECT section_id AS "sectionId"
    FROM unnest(ARRAY[${Prisma.join(ids)}]::int[]) AS section_id
  `;
}

async function loadNavigationAggregate(
  tx: Prisma.TransactionClient,
  userId: string,
  referenceDate: Date,
  options: AggregateOptions = {},
): Promise<WorkspaceNavigationAggregate> {
  const referenceNow = shanghaiDayjs(referenceDate);
  const todayStart = referenceNow.startOf("day").toDate();
  const tomorrowStart = referenceNow.add(1, "day").startOf("day").toDate();
  const semesters =
    options.semesters ??
    (await (async () => {
      countWorkspaceStageQuery(options.stageCounter);
      return tx.semester.findMany({
        select: { id: true, startDate: true, endDate: true },
        orderBy: { startDate: "asc" },
      });
    })());
  const currentSemester = selectCurrentSemesterFromList(
    Array.from(semesters),
    referenceDate,
  );
  const semesterStart = currentSemester?.startDate
    ? shanghaiDayjs(currentSemester.startDate).startOf("day").toDate()
    : referenceNow.subtract(6, "month").startOf("day").toDate();
  const semesterEnd = currentSemester?.endDate
    ? shanghaiDayjs(currentSemester.endDate).endOf("day").toDate()
    : referenceNow.add(6, "month").endOf("day").toDate();
  const nowHHmm = referenceNow.hour() * 100 + referenceNow.minute();

  const scopedSections = options.activeSections;
  const activeSectionIds = scopedSections
    ?.filter(
      (section) =>
        section.retiredAt === null || section.retiredAt === undefined,
    )
    .map((section) => section.id);
  const currentSemesterSectionIds = scopedSections
    ?.filter(
      (section) =>
        (section.retiredAt === null || section.retiredAt === undefined) &&
        currentSemester !== null &&
        section.semesterId === (currentSemester?.id ?? null),
    )
    .map((section) => section.id);
  const sectionScope =
    activeSectionIds && currentSemesterSectionIds
      ? Prisma.sql`
          active_sections AS (${sectionIdsSql(activeSectionIds)}),
          current_semester_sections AS (${sectionIdsSql(currentSemesterSectionIds)})
        `
      : Prisma.sql`
          subscribed_sections AS (
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
            WHERE "semesterId" = ${currentSemester?.id ?? null}
          )
        `;
  const subscribedSectionCount =
    scopedSections === undefined
      ? Prisma.sql`(SELECT count(*) FROM subscribed_sections)`
      : Prisma.sql`${scopedSections.length}`;
  const pendingTodosCount = options.skipPendingTodosCount
    ? Prisma.sql`0`
    : Prisma.sql`(
        SELECT count(*)
        FROM "Todo" AS todo
        WHERE todo."userId" = ${userId}
          AND NOT todo.completed
      )`;

  countWorkspaceStageQuery(options.stageCounter);
  const [row] = await tx.$queryRaw<WorkspaceNavigationCountRow[]>`
    WITH ${sectionScope},
    pending_homeworks AS MATERIALIZED (
      SELECT homework."submissionDueAt"
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
    )
    SELECT
      ${subscribedSectionCount} AS subscribed_section_count,
      ${pendingTodosCount} AS pending_todos_count,
      (SELECT count(*) FROM pending_homeworks)
        AS pending_homeworks_count,
      (
        SELECT COALESCE(
          bool_or(
            pending."submissionDueAt" >= ${todayStart}
            AND pending."submissionDueAt" < ${tomorrowStart}
          ),
          FALSE
        )
        FROM pending_homeworks AS pending
      ) AS highlight_pending_homeworks,
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
    calendarItemsCount: Number(row.calendar_items_count),
    examsCount: Number(row.exams_count),
    highlightPendingHomeworks: Boolean(row.highlight_pending_homeworks),
    pendingHomeworksCount: Number(row.pending_homeworks_count),
    pendingTodosCount: Number(row.pending_todos_count),
    subscribedSectionCount: Number(row.subscribed_section_count),
  };
}

/**
 * Shared one-query navigation read model for the shell and workspace tabs.
 * Workspace callers pass the section/semester rows they already loaded so
 * this aggregate does not repeat those reads in a nested RLS context.
 */
export async function getWorkspaceNavigationAggregate(
  tx: Prisma.TransactionClient,
  userId: string,
  referenceDate: Date = new Date(),
  options: AggregateOptions = {},
) {
  return loadNavigationAggregate(tx, userId, referenceDate, options);
}

export async function getWorkspaceNavigationSummary(
  userId: string,
  referenceDate: Date = new Date(),
): Promise<WorkspaceNavigationSummary> {
  const aggregate = await withUserDbContext(userId, (tx) =>
    getWorkspaceNavigationAggregate(tx, userId, referenceDate),
  );

  return {
    userId,
    calendarItemsCount: aggregate.calendarItemsCount,
    examsCount: aggregate.examsCount,
    pendingHomeworksCount: aggregate.pendingHomeworksCount,
    pendingTodosCount: aggregate.pendingTodosCount,
    subscribedSectionCount: aggregate.subscribedSectionCount,
  };
}
