import { DEFAULT_LOCALE } from "@/i18n/config";
import { getPrisma } from "@/lib/db/prisma";
import { toShanghaiIsoString } from "@/lib/time/serialize-date-output";
import { withSubscribedSections } from "./subscription-read-model-shared";

type SubscriptionTabExam = {
  id: number;
  examDate: Date | null;
  startTime: number | null;
  endTime: number | null;
  examType: number | null;
  examMode: string | null;
  examTakeCount: number | null;
  examBatch: {
    nameCn: string;
    nameEn: string | null;
    namePrimary: string;
    nameSecondary: string | null;
  } | null;
  examRooms: Array<{
    room: string;
    count: number;
  }>;
};

export async function listSubscribedSectionsForSubscriptionsTab(
  userId: string,
  locale = DEFAULT_LOCALE,
  options: { includeExams?: boolean; sectionIds?: readonly number[] } = {},
) {
  const includeExams = options.includeExams === true;

  return withSubscribedSections(
    userId,
    async (ids) => {
      const baseSelect = {
        id: true,
        jwId: true,
        code: true,
        credits: true,
        course: { select: { namePrimary: true } },
        semester: { select: { id: true, nameCn: true, startDate: true } },
        teachers: { select: { namePrimary: true } },
      };
      const examSelect = {
        exams: {
          select: {
            id: true,
            examDate: true,
            startTime: true,
            endTime: true,
            examType: true,
            examMode: true,
            examTakeCount: true,
            examBatch: {
              select: {
                nameCn: true,
                nameEn: true,
                namePrimary: true,
                nameSecondary: true,
              },
            },
            examRooms: { select: { room: true, count: true } },
          },
          orderBy: [{ examDate: "asc" as const }],
        },
      };

      return getPrisma(locale).section.findMany({
        where: { id: { in: ids } },
        select: includeExams ? { ...baseSelect, ...examSelect } : baseSelect,
        orderBy: [{ semester: { jwId: "desc" } }, { code: "asc" }],
      });
    },
    options.sectionIds,
  );
}

export function subscriptionSectionFromRow(
  row: Awaited<
    ReturnType<typeof listSubscribedSectionsForSubscriptionsTab>
  >[number],
) {
  const exams: SubscriptionTabExam[] =
    "exams" in row ? (row.exams as SubscriptionTabExam[]) : [];

  return {
    id: row.id,
    jwId: row.jwId,
    code: row.code,
    credits: row.credits,
    course: {
      namePrimary: row.course?.namePrimary ?? null,
    },
    semester: row.semester
      ? {
          id: row.semester.id,
          nameCn: row.semester.nameCn,
          startDate: row.semester.startDate
            ? toShanghaiIsoString(row.semester.startDate)
            : null,
        }
      : null,
    teachers: row.teachers.map((teacher) => ({
      namePrimary: teacher.namePrimary,
    })),
    exams: exams.map((exam) => ({
      id: exam.id,
      examDate: exam.examDate ? toShanghaiIsoString(exam.examDate) : null,
      startTime: exam.startTime,
      endTime: exam.endTime,
      examType: exam.examType,
      examMode: exam.examMode,
      examTakeCount: exam.examTakeCount,
      examBatch: exam.examBatch
        ? {
            nameCn: exam.examBatch.nameCn,
            nameEn: exam.examBatch.nameEn,
            namePrimary: exam.examBatch.namePrimary,
            nameSecondary: exam.examBatch.nameSecondary,
          }
        : null,
      examRooms: exam.examRooms.map((room) => ({
        room: room.room,
        count: room.count,
      })),
    })),
  };
}
