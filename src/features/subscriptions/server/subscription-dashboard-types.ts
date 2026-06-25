import type { Prisma } from "@/generated/prisma/client";
import type { buildDashboardHomeworkSelect } from "./subscription-homework-selects";

type DashboardHomeworkBase = Prisma.HomeworkGetPayload<{
  select: ReturnType<typeof buildDashboardHomeworkSelect>;
}>;

type DashboardHomeworkSection = NonNullable<DashboardHomeworkBase["section"]>;
type DashboardHomeworkCourse = NonNullable<DashboardHomeworkSection["course"]>;

export type HomeworkWithSection = {
  [Key in keyof Omit<
    DashboardHomeworkBase,
    "description" | "section"
  >]: DashboardHomeworkBase[Key];
} & {
  description?: DashboardHomeworkBase["description"];
  section:
    | (Omit<DashboardHomeworkSection, "course"> & {
        course:
          | (DashboardHomeworkCourse & {
              namePrimary: string | null;
            })
          | null;
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
