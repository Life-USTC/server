export const TEACHING_ASSISTANT_SUBSCRIPTION_KIND =
  "teaching_assistant" as const;

type HomeworkCompletionState = {
  completion?: unknown | null;
  homeworkCompletions?: readonly unknown[];
  completionRequired?: boolean;
  submissionDueAt?: Date | string | null;
};

/**
 * The requirement belongs to the viewer's section subscription, so the value
 * is derived at read time instead of persisted on Homework.
 */
export function completionRequiredForSubscriptionKind(
  kind: string | null | undefined,
) {
  return kind !== TEACHING_ASSISTANT_SUBSCRIPTION_KIND;
}

export function attachHomeworkCompletionRequired<
  T extends { sectionId: number },
>(
  homeworks: readonly T[],
  subscriptionKinds: ReadonlyMap<number, string>,
): Array<T & { completionRequired: boolean }> {
  return homeworks.map((homework) => ({
    ...homework,
    completionRequired: completionRequiredForSubscriptionKind(
      subscriptionKinds.get(homework.sectionId),
    ),
  }));
}

/**
 * Returns the pending state used by workspace lists, overview buckets, and
 * calendar sources. A TA homework remains pending until its due instant, or
 * indefinitely when it has no due date. Actual completion still wins first.
 */
export function isHomeworkPendingForViewer(
  homework: HomeworkCompletionState,
  atTime: Date,
) {
  const hasCompletion =
    homework.completion != null ||
    (homework.homeworkCompletions?.length ?? 0) > 0;
  if (hasCompletion) return false;

  if (
    homework.completionRequired !== false ||
    homework.submissionDueAt == null
  ) {
    return true;
  }

  const dueAt = new Date(homework.submissionDueAt);
  if (Number.isNaN(dueAt.getTime())) return true;
  return dueAt.getTime() > atTime.getTime();
}
