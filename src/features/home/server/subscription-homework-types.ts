import type { Prisma } from "@/generated/prisma/client";

type SubscribedHomeworkBaseRecord = Prisma.HomeworkGetPayload<{
  include: {
    section: { include: { course: true; semester: true } };
    description: true;
    homeworkCompletions: { select: { completedAt: true } };
  };
}>;

type SubscribedHomeworkSection = NonNullable<
  SubscribedHomeworkBaseRecord["section"]
>;

export type SubscribedHomeworkRecord = Omit<
  SubscribedHomeworkBaseRecord,
  "section"
> & {
  section:
    | (Omit<SubscribedHomeworkSection, "course"> & {
        course:
          | (SubscribedHomeworkSection["course"] & {
              namePrimary: string | null;
            })
          | null;
      })
    | null;
};

export type HomeworkSummaryItem = {
  id: string;
  title: string;
  isMajor: boolean;
  requiresTeam: boolean;
  publishedAt: string | null;
  submissionStartAt: string | null;
  submissionDueAt: string | null;
  createdAt: string;
  description: string | null;
  completion: { completedAt: string } | null;
  section: {
    jwId: number | null;
    code: string | null;
    courseName: string | null;
    semesterName: string | null;
  } | null;
};
