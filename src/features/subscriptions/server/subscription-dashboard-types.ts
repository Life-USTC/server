import type { Prisma } from "@/generated/prisma/client";
import type { buildDashboardHomeworkSelect } from "./subscription-homework-selects";

type DashboardHomeworkBase = Prisma.HomeworkGetPayload<{
  select: ReturnType<typeof buildDashboardHomeworkSelect>;
}>;

type DashboardHomeworkSection = NonNullable<DashboardHomeworkBase["section"]>;

/**
 * `namePrimary`/`nameSecondary` come from the localized-names Prisma client
 * extension, so `HomeworkGetPayload` resolves them to `never`. Declare the
 * selected course shape instead of deriving it.
 */
type DashboardHomeworkCourse = {
  nameCn: string;
  nameEn: string | null;
  namePrimary: string | null;
  nameSecondary: string | null;
};

export type HomeworkWithSection = Omit<
  DashboardHomeworkBase,
  "description" | "section"
> & {
  description?: DashboardHomeworkBase["description"];
  homeworkCompletions: Array<{ completedAt: Date }>;
  section:
    | (Omit<DashboardHomeworkSection, "course"> & {
        course: DashboardHomeworkCourse | null;
      })
    | null;
};

export type SectionWithRelations = {
  id: number;
  jwId: number | null;
  course: { namePrimary: string | null };
  semester: { id: number } | null;
  schedules: Array<{
    id: number;
    date: Date | null;
    startTime: number;
    endTime: number;
    customPlace: string | null;
    room: {
      namePrimary: string;
      building: {
        namePrimary: string;
        campus: { namePrimary: string } | null;
      } | null;
    } | null;
    teachers?: Array<{ namePrimary: string }>;
  }>;
  exams: Array<{
    id: number;
    examDate: Date | null;
    startTime: number | null;
    endTime: number | null;
    examType: number | null;
    examTakeCount: number | null;
    examMode: string | null;
    examRooms: Array<{ room: string; count: number }>;
  }>;
};

export type SubscriptionSchedule = SectionWithRelations["schedules"][number];
