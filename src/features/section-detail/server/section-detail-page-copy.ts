import type { AppLocale } from "@/i18n/config";
import enUsMessages from "../../../../messages/en-us.json";
import zhCnMessages from "../../../../messages/zh-cn.json";

const messages = {
  "en-us": enUsMessages,
  "zh-cn": zhCnMessages,
};

export function getSectionDetailPageCopy(locale: AppLocale) {
  const copy = messages[locale];
  return {
    common: copy.common,
    comments: copy.comments,
    descriptions: copy.descriptions,
    homeworks: copy.homeworks,
    metadata: copy.metadata,
    sectionDetail: copy.sectionDetail,
  };
}

export function normalizeSectionDetailTab(tab: string | null) {
  if (tab === "schedule" || tab === "exams") return "calendar";
  if (tab === "homeworks") return "homework";
  return tab && ["calendar", "homework", "comments"].includes(tab)
    ? tab
    : "homework";
}
