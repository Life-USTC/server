import type { SubmitFunction } from "@sveltejs/kit";
import {
  dateTimeInputValue,
  initialHomeworkDraft,
  type SectionDetailPageData,
  type SectionHomework,
  type SectionTab,
  sectionSemesterDate,
} from "./section-detail-controller-helpers";
import {
  persistSectionHomeworkView,
  type SectionHomeworkView,
  setSectionDetailTabHash,
} from "./section-detail-controller-navigation";

export function createSectionDetailUiActions(input: {
  getSection: () => SectionDetailPageData["section"];
  getSelectedHomework: () => SectionHomework | null;
  setActiveTab: (value: SectionTab) => void;
  setCreateHomeworkPublishedAt: (value: string) => void;
  setCreateHomeworkSubmissionDueAt: (value: string) => void;
  setCreateHomeworkSubmissionStartAt: (value: string) => void;
  setEditHomeworkMessage: (value: string) => void;
  setEditHomeworkPublishedAt: (value: string) => void;
  setEditHomeworkSubmissionDueAt: (value: string) => void;
  setEditHomeworkSubmissionStartAt: (value: string) => void;
  setEditingHomework: (value: boolean) => void;
  setHomeworkMessage: (value: string) => void;
  setHomeworkView: (value: SectionHomeworkView) => void;
  setShowCreateHomework: (value: boolean) => void;
  setShowSubscribeDialog: (value: boolean) => void;
  setSubscriptionPendingAction: (
    value: "subscribe" | "unsubscribe" | null,
  ) => void;
}) {
  function setActiveTab(
    nextTab: SectionTab,
    options: { syncHash?: boolean } = {},
  ) {
    input.setActiveTab(nextTab);
    if (options.syncHash === false) return;
    setSectionDetailTabHash(nextTab);
  }

  function setHomeworkView(nextView: SectionHomeworkView) {
    input.setHomeworkView(nextView);
    persistSectionHomeworkView(nextView);
  }

  function openCreateHomeworkDialog() {
    const draft = initialHomeworkDraft();
    input.setCreateHomeworkPublishedAt(draft.publishedAt);
    input.setCreateHomeworkSubmissionStartAt(draft.submissionStartAt);
    input.setCreateHomeworkSubmissionDueAt(draft.submissionDueAt);
    input.setHomeworkMessage("");
    input.setShowCreateHomework(true);
  }

  function closeCreateHomeworkDialog() {
    input.setShowCreateHomework(false);
    input.setHomeworkMessage("");
  }

  function startEditHomework() {
    const selectedHomework = input.getSelectedHomework();
    if (!selectedHomework) return;
    input.setEditHomeworkPublishedAt(
      dateTimeInputValue(selectedHomework.publishedAt),
    );
    input.setEditHomeworkSubmissionStartAt(
      dateTimeInputValue(selectedHomework.submissionStartAt),
    );
    input.setEditHomeworkSubmissionDueAt(
      dateTimeInputValue(selectedHomework.submissionDueAt),
    );
    input.setEditHomeworkMessage("");
    input.setEditingHomework(true);
  }

  function cancelEditHomework() {
    input.setEditingHomework(false);
    input.setEditHomeworkMessage("");
  }

  function semesterDate(kind: "start" | "end") {
    return sectionSemesterDate(input.getSection().semester, kind);
  }

  function subscriptionAction(
    action: "subscribe" | "unsubscribe",
  ): SubmitFunction {
    return () => {
      input.setSubscriptionPendingAction(action);
      return async ({ update }) => {
        try {
          await update({ reset: false });
          if (action === "subscribe") {
            input.setShowSubscribeDialog(false);
          }
        } finally {
          input.setSubscriptionPendingAction(null);
        }
      };
    };
  }

  return {
    cancelEditHomework,
    closeCreateHomeworkDialog,
    closeSubscribeDialog: () => input.setShowSubscribeDialog(false),
    openCreateHomeworkDialog,
    openSubscribeDialog: () => input.setShowSubscribeDialog(true),
    semesterDate,
    setActiveTab,
    setHomeworkView,
    startEditHomework,
    subscriptionAction,
  };
}
