import {
  getHomeworkDescriptionValidationError,
  getHomeworkTitleValidationError,
} from "@/features/homeworks/lib/homework-schema";
import { parseShanghaiDateTimeLocalInput } from "@/lib/time/shanghai-format";
import type { SectionDetailPageData } from "./section-detail-controller-helpers";

type HomeworkCopy = SectionDetailPageData["copy"]["homeworks"];

type SectionHomeworkFormTimestamps = {
  publishedAt: string;
  submissionDueAt: string;
  submissionStartAt: string;
};

export type SectionHomeworkMutationPayload = {
  title: string;
  description: string;
  publishedAt: string | null;
  submissionStartAt: string | null;
  submissionDueAt: string | null;
  isMajor: boolean;
  requiresTeam: boolean;
};

function formCheckbox(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function validateSectionHomeworkInput(
  input: SectionHomeworkFormTimestamps & {
    description: string;
    title: string;
  },
  homeworkCopy: HomeworkCopy,
) {
  const titleError = getHomeworkTitleValidationError(input.title);
  if (titleError === "required") return homeworkCopy.titleRequired;
  if (titleError === "too_long") {
    return homeworkCopy.errorTitleTooLong;
  }
  if (getHomeworkDescriptionValidationError(input.description)) {
    return homeworkCopy.errorDescriptionTooLong;
  }
  const publishedAt = parseShanghaiDateTimeLocalInput(input.publishedAt);
  if (publishedAt === undefined) return homeworkCopy.errorInvalidPublishDate;
  const submissionStartAt = parseShanghaiDateTimeLocalInput(
    input.submissionStartAt,
  );
  if (submissionStartAt === undefined) {
    return homeworkCopy.errorInvalidSubmissionStart;
  }
  const submissionDueAt = parseShanghaiDateTimeLocalInput(
    input.submissionDueAt,
  );
  if (submissionDueAt === undefined) {
    return homeworkCopy.errorInvalidSubmissionDue;
  }
  if (
    submissionStartAt &&
    submissionDueAt &&
    submissionStartAt.getTime() > submissionDueAt.getTime()
  ) {
    return homeworkCopy.errorSubmissionRange;
  }
  return "";
}

export function sectionHomeworkPayloadFromFormData({
  formData,
  homeworkCopy,
  timestamps,
}: {
  formData: FormData;
  homeworkCopy: HomeworkCopy;
  timestamps: SectionHomeworkFormTimestamps;
}): { error: string; payload: SectionHomeworkMutationPayload | null } {
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const error = validateSectionHomeworkInput(
    {
      ...timestamps,
      description,
      title,
    },
    homeworkCopy,
  );

  if (error) {
    return { error, payload: null };
  }

  return {
    error: "",
    payload: {
      title,
      description,
      publishedAt: timestamps.publishedAt || null,
      submissionStartAt: timestamps.submissionStartAt || null,
      submissionDueAt: timestamps.submissionDueAt || null,
      isMajor: formCheckbox(formData, "isMajor"),
      requiresTeam: formCheckbox(formData, "requiresTeam"),
    },
  };
}
