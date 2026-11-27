import type { AppLocale } from "@/i18n/config";
import { getSectionFeatureCopy } from "@/i18n/section-copy";

export function getCommentsCopy(locale: AppLocale) {
  const messages = getSectionFeatureCopy(locale);
  return {
    comments: messages.comments,
    uploads: messages.uploads,
  };
}
