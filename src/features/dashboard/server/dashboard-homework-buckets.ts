import type dayjs from "dayjs";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";
import type { HomeworkWithSection } from "./dashboard-types";

export const computeHomeworkBuckets = (
  homeworks: HomeworkWithSection[],
  todayStart: dayjs.Dayjs,
) => {
  const incompleteHomeworks = homeworks.filter(
    (homework) => homework.homeworkCompletions.length === 0,
  );
  const incompleteWithDueAt = incompleteHomeworks.flatMap((homework) =>
    homework.submissionDueAt
      ? [{ homework, due: shanghaiDayjs(homework.submissionDueAt) }]
      : [],
  );
  const dueToday = incompleteWithDueAt
    .filter(({ due }) => due.isSame(todayStart, "day"))
    .map(({ homework }) => homework);
  const dueSoonEnd = todayStart.add(4, "day");
  const dueWithin3Days = incompleteWithDueAt
    .filter(({ due }) => due.isAfter(todayStart) && due.isBefore(dueSoonEnd))
    .map(({ homework }) => homework);

  return { incompleteHomeworks, dueToday, dueWithin3Days };
};
