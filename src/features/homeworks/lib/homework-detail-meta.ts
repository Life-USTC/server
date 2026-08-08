export type HomeworkDetailMetaValue = Date | string | null | undefined;

export type HomeworkDetailMetaKey =
  | "publishedAt"
  | "submissionDueAt"
  | "submissionStartAt";

export type HomeworkDetailMetaRow = {
  emphasis: boolean;
  hint: string | null;
  key: HomeworkDetailMetaKey;
  label: string;
  value: string;
};

export type HomeworkDetailTagKey = "major" | "team";

export type HomeworkDetailTag = {
  key: HomeworkDetailTagKey;
  label: string;
  variant: "secondary";
};

type HomeworkDetailDates = {
  publishedAt?: HomeworkDetailMetaValue;
  submissionDueAt?: HomeworkDetailMetaValue;
  submissionStartAt?: HomeworkDetailMetaValue;
};

type HomeworkDetailFlags = {
  isMajor?: boolean | null;
  requiresTeam?: boolean | null;
};

function optionalText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Homework timeline cells in reading order (publish → submission window). The
 * due cell carries `emphasis` because it is the value users scan for, and an
 * optional `hint` for a relative label such as "in 3 days".
 */
export function buildHomeworkDetailMetaRows({
  dueHint,
  formatDate,
  homework,
  labels,
}: {
  dueHint?: string | null;
  formatDate: (value: HomeworkDetailMetaValue) => string;
  homework: HomeworkDetailDates;
  labels: {
    publishedAt: string;
    submissionDue: string;
    submissionStart: string;
  };
}): HomeworkDetailMetaRow[] {
  return [
    {
      emphasis: false,
      hint: null,
      key: "publishedAt",
      label: labels.publishedAt,
      value: formatDate(homework.publishedAt),
    },
    {
      emphasis: false,
      hint: null,
      key: "submissionStartAt",
      label: labels.submissionStart,
      value: formatDate(homework.submissionStartAt),
    },
    {
      emphasis: true,
      hint: optionalText(dueHint),
      key: "submissionDueAt",
      label: labels.submissionDue,
      value: formatDate(homework.submissionDueAt),
    },
  ];
}

/**
 * Attribute chips share one variant so they read as a uniform group next to the
 * completion status badge, which carries its own emphasis.
 */
export function buildHomeworkDetailTags({
  homework,
  labels,
}: {
  homework: HomeworkDetailFlags;
  labels: {
    tagMajor: string;
    tagTeam: string;
  };
}): HomeworkDetailTag[] {
  const tags: HomeworkDetailTag[] = [];
  if (homework.isMajor) {
    tags.push({ key: "major", label: labels.tagMajor, variant: "secondary" });
  }
  if (homework.requiresTeam) {
    tags.push({ key: "team", label: labels.tagTeam, variant: "secondary" });
  }
  return tags;
}
