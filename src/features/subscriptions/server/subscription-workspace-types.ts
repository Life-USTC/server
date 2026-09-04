import type { Prisma } from "@/generated/prisma/client";
import type { buildWorkspaceHomeworkSelect } from "./subscription-homework-selects";

type WorkspaceHomeworkBase = Prisma.HomeworkGetPayload<{
  select: ReturnType<typeof buildWorkspaceHomeworkSelect>;
}>;

type WorkspaceHomeworkSection = NonNullable<WorkspaceHomeworkBase["section"]>;

/**
 * `namePrimary`/`nameSecondary` come from the localized-names Prisma client
 * extension, so `HomeworkGetPayload` resolves them to `never`. Declare the
 * selected course shape instead of deriving it.
 */
type WorkspaceHomeworkCourse = {
  nameCn: string;
  nameEn: string | null;
  namePrimary: string | null;
  nameSecondary: string | null;
};

export type HomeworkWithSection = Omit<
  WorkspaceHomeworkBase,
  "description" | "section"
> & {
  description?: WorkspaceHomeworkBase["description"];
  homeworkCompletions: Array<{ completedAt: Date }>;
  section:
    | (Omit<WorkspaceHomeworkSection, "course"> & {
        course: WorkspaceHomeworkCourse | null;
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
