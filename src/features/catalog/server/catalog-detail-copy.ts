import type { AppLocale } from "@/i18n/config";
import enUsMessages from "../../../../messages/en-us.json";
import zhCnMessages from "../../../../messages/zh-cn.json";

const messages = {
  "en-us": enUsMessages,
  "zh-cn": zhCnMessages,
};

export function getCourseDetailCopy(locale: AppLocale) {
  const copy = messages[locale];
  return {
    common: copy.common,
    course: copy.course,
    courseDetail: copy.courseDetail,
    descriptions: copy.descriptions,
    metadata: copy.metadata,
    notFound: copy.notFound,
  };
}

export function getTeacherDetailCopy(locale: AppLocale) {
  const copy = messages[locale];
  return {
    common: copy.common,
    comments: copy.comments,
    descriptions: copy.descriptions,
    metadata: copy.metadata,
    notFound: copy.notFound,
    teacherDetail: copy.teacherDetail,
  };
}
