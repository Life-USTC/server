import { toast } from "@ui-sdk/svelte/toast";
import { initialHomeworkTimestampDraft } from "@/features/homeworks/lib/homework-timestamp-defaults";
import { createWorkspaceCalendarActions } from "@/features/workspace/lib/workspace-controller-calendar-actions";
import { createWorkspaceCalendarDisplayActions } from "@/features/workspace/lib/workspace-controller-calendar-display-actions";
import { createWorkspaceDisplayActions } from "@/features/workspace/lib/workspace-controller-display-actions";
import { createWorkspaceFormSubmitActions } from "@/features/workspace/lib/workspace-controller-form-actions";
import type {
  CalendarData,
  CatalogLinkItem,
  HomeworkItem,
  SignedWorkspaceData,
  TodoItem,
  WorkspacePageData,
  WorkspaceRootCopy,
} from "@/features/workspace/lib/workspace-controller-helpers";
import { createWorkspaceHomeworkStateActions } from "@/features/workspace/lib/workspace-controller-homework-state-actions";
import { createWorkspaceLinkStateActions } from "@/features/workspace/lib/workspace-controller-link-state-actions";
import { mountWorkspaceController } from "@/features/workspace/lib/workspace-controller-mount";
import { createWorkspaceSubscriptionActions } from "@/features/workspace/lib/workspace-controller-subscription-actions";
import { createWorkspaceTodoActions } from "@/features/workspace/lib/workspace-controller-todo-actions";
import { workspaceTabHref } from "@/features/workspace/lib/workspace-nav";
import { goto, invalidateAll } from "$app/navigation";

import type { WorkspaceControllerState } from "./workspace-controller-default-state";

type Setter<T> = (value: T) => void;

export function createWorkspacePageControllerActions(input: {
  state: WorkspaceControllerState;
  getCalendarData: () => CalendarData | null;
  getCatalogLinkSourceItems: () => CatalogLinkItem[];
  getData: () => WorkspacePageData;
  getHomeworkItems: () => HomeworkItem[];
  getSignedData: () => SignedWorkspaceData | null;
  getTodoSourceItems: () => TodoItem[];
  getCopy: () => WorkspaceRootCopy;
  setCatalogLinkSourceItems: Setter<CatalogLinkItem[]>;
  setHomeworkItems: Setter<HomeworkItem[]>;
  setTodoSourceItems: Setter<TodoItem[]>;
}) {
  const { state } = input;
  function set<K extends keyof WorkspaceControllerState>(key: K) {
    return (value: WorkspaceControllerState[K]) => {
      state[key] = value;
    };
  }
  const getTodosCopy = () => input.getCopy().todos;
  const getHomeworksCopy = () => input.getCopy().homeworks;
  const getSectionCopy = () => input.getCopy().sectionDetail;
  const getWorkspaceCopy = () => input.getCopy().workspace;
  const getSubscriptionsCopy = () => input.getCopy().subscriptions;
  const getCommonCopy = () => input.getCopy().common;

  function openTodoEditor(todo: TodoItem) {
    state.selectedTodo = null;
    state.editTodoError = "";
    state.editingTodo = todo;
  }

  function openCreateHomeworkDialog() {
    const draft = initialHomeworkTimestampDraft();
    state.createHomeworkSectionId = String(
      input.getSignedData()?.homeworks?.sections[0]?.id ?? "",
    );
    state.createHomeworkPublishedAt = draft.publishedAt;
    state.createHomeworkSubmissionStartAt = draft.submissionStartAt;
    state.createHomeworkSubmissionDueAt = draft.submissionDueAt;
    state.createHomeworkAdvancedOpen = false;
    state.createHomeworkError = "";
    state.showCreateHomework = true;
  }

  const todo = createWorkspaceTodoActions({
    getEditingTodo: () => state.editingTodo,
    getSelectedTodo: () => state.selectedTodo,
    getTodoItems: input.getTodoSourceItems,
    getTodoSavingById: () => state.todoSavingById,
    getTodosCopy,
    onSuccess: (action) => {
      const todosCopy = getTodosCopy();
      toast.success(
        action === "delete"
          ? todosCopy.deleteSuccess
          : action === "complete"
            ? todosCopy.completeSuccess
            : todosCopy.uncompleteSuccess,
      );
    },
    setEditingTodo: set("editingTodo"),
    setSelectedTodo: set("selectedTodo"),
    setTodoActionError: set("todoActionError"),
    setTodoItems: input.setTodoSourceItems,
    setTodoSavingById: set("todoSavingById"),
  });

  const display = createWorkspaceDisplayActions({
    getCountLabel: () => getSectionCopy().examCount,
    getFinalLabel: () => getSectionCopy().examTypeFinal,
    getLocale: () => input.getData().locale as "en-us" | "zh-cn",
    getMidtermLabel: () => getSectionCopy().examTypeMidterm,
  });

  const form = createWorkspaceFormSubmitActions({
    getHomeworksCopy,
    getTodosCopy,
    onSuccess: (action) => {
      if (action === "createHomework") state.showCreateHomework = false;
      toast.success(
        String(
          action === "createHomework"
            ? getHomeworksCopy().createSuccess
            : action === "createTodo"
              ? getTodosCopy().createSuccess
              : getTodosCopy().updateSuccess,
        ),
      );
    },
    setCreateHomeworkError: set("createHomeworkError"),
    setCreateTodoError: set("createTodoError"),
    setCreatingHomework: set("isCreatingHomework"),
    setCreatingTodo: set("isCreatingTodo"),
    setEditTodoError: set("editTodoError"),
    setEditingTodo: set("editingTodo") as (value: null) => void,
    setShowCreateTodo: set("showCreateTodo"),
    setUpdatingTodo: set("isUpdatingTodo"),
  });

  const subscription = createWorkspaceSubscriptionActions({
    getBulkImportSemesterId: () => state.bulkImportSemesterId,
    getBulkImportText: () => state.bulkImportText,
    getCurrentSemesterId: () =>
      input.getSignedData()?.subscriptions?.currentSemesterId ?? null,
    getSelectedImportSectionIds: () => state.selectedImportSectionIds,
    getSubscriptionsCopy,
    invalidateAll,
    onSuccess: (message) => {
      toast.success(message);
    },
    setBulkImportError: set("bulkImportError"),
    setBulkImportMessage: set("bulkImportMessage"),
    setBulkImportOpen: set("isBulkImportOpen"),
    setBulkImportSemesterId: set("bulkImportSemesterId"),
    setBulkImportText: set("bulkImportText"),
    setConfirmImportOpen: set("isConfirmImportOpen"),
    setImportingSections: set("isImportingSections"),
    setMatchedSections: set("matchedSections"),
    setMatchingSections: set("isMatchingSections"),
    setRemovingSectionId: set("removingSectionId"),
    setSelectedImportSectionIds: set("selectedImportSectionIds"),
    setSubscriptionActionError: set("subscriptionActionError"),
    setUnmatchedSectionCodes: set("unmatchedSectionCodes"),
  });

  const homework = createWorkspaceHomeworkStateActions({
    getHomeworkItems: input.getHomeworkItems,
    getHomeworkSavingById: () => state.homeworkSavingById,
    getHomeworksCopy,
    getSelectedHomework: () => state.selectedHomework,
    onSuccess: (action) => {
      const homeworksCopy = getHomeworksCopy();
      toast.success(
        action === "complete"
          ? homeworksCopy.markComplete
          : homeworksCopy.markIncomplete,
      );
    },
    setHomeworkActionError: set("homeworkActionError"),
    setHomeworkItems: input.setHomeworkItems,
    setHomeworkSavingById: set("homeworkSavingById"),
    setSelectedHomework: set("selectedHomework"),
  });

  const link = createWorkspaceLinkStateActions({
    getWorkspaceCopy,
    getCatalogLinkItems: input.getCatalogLinkSourceItems,
    getLinkReturnTo: () => state.linkReturnTo,
    getUpdatingCatalogLinkSlug: () => state.updatingCatalogLinkSlug,
    onSuccess: (action) => {
      const workspaceCopy = getWorkspaceCopy();
      toast.success(
        action === "pin"
          ? workspaceCopy.linkHub.pin
          : workspaceCopy.linkHub.unpin,
      );
    },
    setCatalogLinkItems: input.setCatalogLinkSourceItems,
    setLinkActionError: set("linkActionError"),
    setUpdatingCatalogLinkSlug: set("updatingCatalogLinkSlug"),
  });

  const calendarDisplay = createWorkspaceCalendarDisplayActions({
    getCommonCourseLabel: () => getCommonCopy().courses,
    getEventLabels: () => ({
      exam: input.getCopy().CalendarEventCard.exam,
      homework: input.getCopy().CalendarEventCard.homework,
      noCompletionRequired: input.getCopy().homeworks.noCompletionRequired,
      todo: input.getCopy().CalendarEventCard.todo,
    }),
    getTodoPriorityLabel: (priority) => getTodosCopy().priority[priority],
    getWeekNumberTemplate: () => getSectionCopy().weekNumber,
    tabHref: workspaceTabHref,
  });

  const calendar = createWorkspaceCalendarActions({
    getCalendarData: input.getCalendarData,
    getCalendarDay: () => state.calendarDay,
    getCalendarMonth: () => state.calendarMonth,
    getCalendarSemesterId: () => state.calendarSemesterId,
    getCalendarView: () => state.calendarView,
    getCalendarWeekStart: () => state.calendarWeekStart,
    navigateUrl: (href) => {
      void goto(href, { reset: false, replaceState: true });
    },
    replaceUrl: (href) => {
      window.history.replaceState({}, "", href);
    },
    setCalendarDay: set("calendarDay"),
    setCalendarMonth: set("calendarMonth"),
    setCalendarSemesterId: set("calendarSemesterId"),
    setCalendarView: set("calendarView"),
    setCalendarWeekStart: set("calendarWeekStart"),
    tabHref: workspaceTabHref,
  });

  function mount() {
    return mountWorkspaceController({
      clearPendingRemoveSection: subscription.clearPendingRemoveSection,
      copy: {
        workspace: getWorkspaceCopy(),
      },
      replaceState: (href) => {
        goto(href, { shallow: true, replace: true });
      },
      setLinkActionError: set("linkActionError"),
      setLinkReturnTo: set("linkReturnTo"),
    });
  }

  return {
    openCreateHomeworkDialog,
    ...todo,
    ...display,
    ...form,
    ...subscription,
    ...homework,
    ...link,
    ...calendarDisplay,
    ...calendar,
    mount,
    openTodoEditor,
  };
}
