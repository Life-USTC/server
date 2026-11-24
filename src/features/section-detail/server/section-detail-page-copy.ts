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
    comments: {
      loadFailed: copy.comments.loadFailed,
      markdownGuide: copy.comments.markdownGuide,
      previewEmpty: copy.comments.previewEmpty,
      retry: copy.comments.retry,
      tabPreview: copy.comments.tabPreview,
      tabSectionTeacher: copy.comments.tabSectionTeacher,
      tabWrite: copy.comments.tabWrite,
    },
    descriptions: copy.descriptions,
    homeworks: copy.homeworks,
    metadata: copy.metadata,
    roomMap: copy.roomMap,
    sectionDetail: {
      ...copy.sectionDetail,
      subscriptions: {
        mySubscription: copy.subscriptions.mySubscription,
        manageSubscription: copy.subscriptions.manageSubscription,
        kindEditor: {
          regular: copy.subscriptions.kindEditor.regular,
          auditor: copy.subscriptions.kindEditor.auditor,
          teaching_assistant: copy.subscriptions.kindEditor.teaching_assistant,
        },
        unsubscribeTitle: copy.subscriptions.unsubscribeTitle,
        unsubscribeDescription: copy.subscriptions.unsubscribeDescription,
        cancelUnsubscribe: copy.subscriptions.cancelUnsubscribe,
        confirmUnsubscribe: copy.subscriptions.confirmUnsubscribe,
        optOutError: copy.subscriptions.optOutError,
      },
    },
  };
}

export type SectionSubscriptionCopy = ReturnType<
  typeof getSectionDetailPageCopy
>["sectionDetail"]["subscriptions"];
