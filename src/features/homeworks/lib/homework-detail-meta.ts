export type HomeworkDetailDateValue = Date | string | null | undefined;

export type HomeworkDetailDateFormatter = (
  value: HomeworkDetailDateValue,
) => string;

/**
 * Primary homework properties per `docs/contracts/_ui.json` "Model Property
 * Priority": the due time, the completion status, and the relative label users
 * scan for. Rendered as the "due summary" block of the detail popup.
 */
export type HomeworkDueSummary = {
  completed: boolean;
  dueLabel: string;
  dueValue: string;
  etaLabel: string | null;
  statusLabel: string;
};

export type HomeworkDetailMetaKey = "publishedAt" | "submissionStartAt";

export type HomeworkDetailMetaRow = {
  key: HomeworkDetailMetaKey;
  label: string;
  value: string;
};

export type HomeworkDetailTagKey = "major" | "team";

export type HomeworkDetailTag = {
  key: HomeworkDetailTagKey;
  label: string;
};

function optionalText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Completion status, never the "standard homework" tag: default homework does
 * not get a badge of its own.
 */
export function homeworkCompletionStatusLabel(
  completed: boolean,
  labels: {
    completedStatus: string;
    incompleteStatus: string;
  },
) {
  return completed ? labels.completedStatus : labels.incompleteStatus;
}

export function buildHomeworkDueSummary({
  completed,
  dueLabel,
  etaLabel,
  formatDate,
  homework,
  statusLabel,
}: {
  completed: boolean;
  dueLabel: string;
  etaLabel?: string | null;
  formatDate: HomeworkDetailDateFormatter;
  homework: { submissionDueAt?: HomeworkDetailDateValue };
  statusLabel: string;
}): HomeworkDueSummary {
  return {
    completed,
    dueLabel,
    dueValue: formatDate(homework.submissionDueAt),
    etaLabel: optionalText(etaLabel),
    statusLabel,
  };
}

/**
 * Secondary/tertiary timestamps for the vertical metadata list. The due date
 * lives in the due summary and platform `createdAt` is intentionally excluded,
 * matching the documented detail popup order.
 */
export function buildHomeworkMetadataRows({
  formatDate,
  homework,
  labels,
}: {
  formatDate: HomeworkDetailDateFormatter;
  homework: {
    publishedAt?: HomeworkDetailDateValue;
    submissionStartAt?: HomeworkDetailDateValue;
  };
  labels: {
    publishedAt: string;
    submissionStart: string;
  };
}): HomeworkDetailMetaRow[] {
  return [
    {
      key: "publishedAt",
      label: labels.publishedAt,
      value: formatDate(homework.publishedAt),
    },
    {
      key: "submissionStartAt",
      label: labels.submissionStart,
      value: formatDate(homework.submissionStartAt),
    },
  ];
}

/**
 * Only non-default attributes become chips: standard homework never gets a
 * "standard" badge.
 */
export function buildHomeworkDetailTags({
  homework,
  labels,
}: {
  homework: {
    isMajor?: boolean | null;
    requiresTeam?: boolean | null;
  };
  labels: {
    tagMajor: string;
    tagTeam: string;
  };
}): HomeworkDetailTag[] {
  const tags: HomeworkDetailTag[] = [];
  if (homework.isMajor) {
    tags.push({ key: "major", label: labels.tagMajor });
  }
  if (homework.requiresTeam) {
    tags.push({ key: "team", label: labels.tagTeam });
  }
  return tags;
}
