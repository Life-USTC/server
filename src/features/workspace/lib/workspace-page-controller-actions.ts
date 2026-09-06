import { toast } from "svelte-sonner";
import type { CalendarView } from "@/features/workspace/lib/calendar";
import { createWorkspaceCalendarActions } from "@/features/workspace/lib/workspace-controller-calendar-actions";
import { createWorkspaceCalendarDisplayActions } from "@/features/workspace/lib/workspace-controller-calendar-display-actions";
import { createWorkspaceCreateHomeworkActions } from "@/features/workspace/lib/workspace-controller-create-homework-actions";
import { createWorkspaceDisplayActions } from "@/features/workspace/lib/workspace-controller-display-actions";
import { createWorkspaceFormSubmitActions } from "@/features/workspace/lib/workspace-controller-form-actions";
import type {
  CalendarData,
  CatalogLinkItem,
  ExamView,
  HomeworkItem,
  HomeworkView,
  LinkView,
  MatchedSection,
  SignedWorkspaceData,
  TodoItem,
  TodoView,
  WorkspacePageData,
  WorkspaceRootCopy,
  WorkspaceViewState,
} from "@/features/workspace/lib/workspace-controller-helpers";
import { createWorkspaceHomeworkStateActions } from "@/features/workspace/lib/workspace-controller-homework-state-actions";
import { createWorkspaceLinkStateActions } from "@/features/workspace/lib/workspace-controller-link-state-actions";
import { mountWorkspaceController } from "@/features/workspace/lib/workspace-controller-mount";
import { createWorkspaceSubscriptionActions } from "@/features/workspace/lib/workspace-controller-subscription-actions";
import { createWorkspaceTodoActions } from "@/features/workspace/lib/workspace-controller-todo-actions";
import { workspaceTabHref } from "@/features/workspace/lib/workspace-nav";
import { goto, invalidateAll, replaceState } from "$app/navigation";

type Setter<T> = (value: T) => void;

export function createWorkspacePageControllerActions(input: {
  getBulkImportSemesterId: () => string;
  getBulkImportText: () => string;
  getCalendarData: () => CalendarData | null;
  getCalendarMonth: () => string;
  getCalendarSemesterId: () => number | null;
  getCalendarView: () => CalendarView;
  getCalendarWeekStart: () => string;
  getCatalogLinkSourceItems: () => CatalogLinkItem[];
  getCreateHomeworkSectionId: () => string;
  getData: () => WorkspacePageData;
  getEditingTodo: () => TodoItem | null;
  getHomeworkItems: () => HomeworkItem[];
  getHomeworkSavingById: () => Record<string, boolean>;
  getLinkReturnTo: () => string;
  getLinkSearchInput: () => HTMLInputElement | null;
  getOverviewLinkSourceItems: () => CatalogLinkItem[];
  getSelectedHomework: () => HomeworkItem | null;
  getSelectedImportSectionIds: () => number[];
  getSelectedTodo: () => TodoItem | null;
  getSignedData: () => SignedWorkspaceData | null;
  getTodoSavingById: () => Record<string, boolean>;
  getTodoSourceItems: () => TodoItem[];
  getUpdatingCatalogLinkSlug: () => string | null;
  getCopy: () => WorkspaceRootCopy;
  setBulkImportError: Setter<string>;
  setBulkImportMessage: Setter<string>;
  setBulkImportOpen: Setter<boolean>;
  setBulkImportSemesterId: Setter<string>;
  setBulkImportText: Setter<string>;
  setCalendarMonth: Setter<string>;
  setCalendarSemesterId: Setter<number | null>;
  setCalendarView: Setter<CalendarView>;
  setCalendarWeekStart: Setter<string>;
  setCatalogLinkSourceItems: Setter<CatalogLinkItem[]>;
  setConfirmImportOpen: Setter<boolean>;
  setCreateHomeworkAdvancedOpen: Setter<boolean>;
  setCreateHomeworkError: Setter<string>;
  setCreateHomeworkPublishedAt: Setter<string>;
  setCreateHomeworkSectionId: Setter<string>;
  setCreateHomeworkSubmissionDueAt: Setter<string>;
  setCreateHomeworkSubmissionStartAt: Setter<string>;
  setCreateTodoError: Setter<string>;
  setCreatingHomework: Setter<boolean>;
  setCreatingTodo: Setter<boolean>;
  setEditTodoError: Setter<string>;
  setEditingTodo: Setter<TodoItem | null>;
  setExamView: Setter<ExamView>;
  setHomeworkActionError: Setter<string>;
  setHomeworkItems: Setter<HomeworkItem[]>;
  setHomeworkSavingById: Setter<Record<string, boolean>>;
  setHomeworkView: Setter<HomeworkView>;
  setImportingSections: Setter<boolean>;
  setLinkActionError: Setter<string>;
  setLinkReturnTo: Setter<string>;
  setLinkView: Setter<LinkView>;
  setMatchedSections: Setter<MatchedSection[]>;
  setMatchingSections: Setter<boolean>;
  setOverviewLinkSourceItems: Setter<CatalogLinkItem[]>;
  setRemovingSectionId: Setter<number | null>;
  setSelectedHomework: Setter<HomeworkItem | null>;
  setSelectedImportSectionIds: Setter<number[]>;
  setSelectedTodo: Setter<TodoItem | null>;
  setShowCreateHomework: Setter<boolean>;
  setShowCreateTodo: Setter<boolean>;
  setSubscriptionActionError: Setter<string>;
  setTodoActionError: Setter<string>;
  setTodoSourceItems: Setter<TodoItem[]>;
  setTodoSavingById: Setter<Record<string, boolean>>;
  setTodoView: Setter<TodoView>;
  setUnmatchedSectionCodes: Setter<string[]>;
  setUpdatingCatalogLinkSlug: Setter<string | null>;
  setUpdatingTodo: Setter<boolean>;
}) {
  const getTodosCopy = () => input.getCopy().todos;
  const getHomeworksCopy = () => input.getCopy().homeworks;
  const getSectionCopy = () => input.getCopy().sectionDetail;
  const getWorkspaceCopy = () => input.getCopy().workspace;
  const getSubscriptionsCopy = () => input.getCopy().subscriptions;
  const getCommonCopy = () => input.getCopy().common;

  function openTodoEditor(todo: TodoItem) {
    input.setSelectedTodo(null);
    input.setEditTodoError("");
    input.setEditingTodo(todo);
  }

  function applyWorkspaceViewState(state: WorkspaceViewState) {
    input.setHomeworkView(state.homeworkView);
    input.setTodoView(state.todoView);
    input.setExamView(state.examView);
    input.setLinkView(state.linkView);
  }

  const createHomework = createWorkspaceCreateHomeworkActions({
    getCreateHomeworkSectionId: input.getCreateHomeworkSectionId,
    getSections: () => input.getSignedData()?.homeworks?.sections ?? [],
    setCreateHomeworkAdvancedOpen: input.setCreateHomeworkAdvancedOpen,
    setCreateHomeworkError: input.setCreateHomeworkError,
    setCreateHomeworkPublishedAt: input.setCreateHomeworkPublishedAt,
    setCreateHomeworkSectionId: input.setCreateHomeworkSectionId,
    setCreateHomeworkSubmissionDueAt: input.setCreateHomeworkSubmissionDueAt,
    setCreateHomeworkSubmissionStartAt:
      input.setCreateHomeworkSubmissionStartAt,
    setShowCreateHomework: input.setShowCreateHomework,
  });

  const todo = createWorkspaceTodoActions({
    getEditingTodo: input.getEditingTodo,
    getSelectedTodo: input.getSelectedTodo,
    getTodoItems: input.getTodoSourceItems,
    getTodoSavingById: input.getTodoSavingById,
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
    setEditingTodo: input.setEditingTodo,
    setSelectedTodo: input.setSelectedTodo,
    setTodoActionError: input.setTodoActionError,
    setTodoItems: input.setTodoSourceItems,
    setTodoSavingById: input.setTodoSavingById,
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
    setCreateHomeworkError: input.setCreateHomeworkError,
    setCreateTodoError: input.setCreateTodoError,
    setCreatingHomework: input.setCreatingHomework,
    setCreatingTodo: input.setCreatingTodo,
    setEditTodoError: input.setEditTodoError,
    setEditingTodo: input.setEditingTodo as (value: null) => void,
    setShowCreateTodo: input.setShowCreateTodo,
    setUpdatingTodo: input.setUpdatingTodo,
  });

  const subscription = createWorkspaceSubscriptionActions({
    getBulkImportSemesterId: input.getBulkImportSemesterId,
    getBulkImportText: input.getBulkImportText,
    getCurrentSemesterId: () =>
      input.getSignedData()?.subscriptions?.currentSemesterId ?? null,
    getSelectedImportSectionIds: input.getSelectedImportSectionIds,
    getSubscriptionsCopy,
    invalidateAll,
    onSuccess: (message) => {
      toast.success(message);
    },
    setBulkImportError: input.setBulkImportError,
    setBulkImportMessage: input.setBulkImportMessage,
    setBulkImportOpen: input.setBulkImportOpen,
    setBulkImportSemesterId: input.setBulkImportSemesterId,
    setBulkImportText: input.setBulkImportText,
    setConfirmImportOpen: input.setConfirmImportOpen,
    setImportingSections: input.setImportingSections,
    setMatchedSections: input.setMatchedSections,
    setMatchingSections: input.setMatchingSections,
    setRemovingSectionId: input.setRemovingSectionId,
    setSelectedImportSectionIds: input.setSelectedImportSectionIds,
    setSubscriptionActionError: input.setSubscriptionActionError,
    setUnmatchedSectionCodes: input.setUnmatchedSectionCodes,
  });

  const homework = createWorkspaceHomeworkStateActions({
    getHomeworkItems: input.getHomeworkItems,
    getHomeworkSavingById: input.getHomeworkSavingById,
    getHomeworksCopy,
    getSelectedHomework: input.getSelectedHomework,
    onSuccess: (action) => {
      const homeworksCopy = getHomeworksCopy();
      toast.success(
        action === "complete"
          ? homeworksCopy.markComplete
          : homeworksCopy.markIncomplete,
      );
    },
    setHomeworkActionError: input.setHomeworkActionError,
    setHomeworkItems: input.setHomeworkItems,
    setHomeworkSavingById: input.setHomeworkSavingById,
    setSelectedHomework: input.setSelectedHomework,
  });

  const link = createWorkspaceLinkStateActions({
    applyWorkspaceViewState,
    getWorkspaceCopy,
    getCatalogLinkItems: input.getCatalogLinkSourceItems,
    getLinkReturnTo: input.getLinkReturnTo,
    getOverviewLinkItems: input.getOverviewLinkSourceItems,
    getUpdatingCatalogLinkSlug: input.getUpdatingCatalogLinkSlug,
    onSuccess: (action) => {
      const workspaceCopy = getWorkspaceCopy();
      toast.success(
        action === "pin"
          ? workspaceCopy.linkHub.pin
          : workspaceCopy.linkHub.unpin,
      );
    },
    replaceState: (href) => {
      replaceState(href, {});
    },
    setCatalogLinkItems: input.setCatalogLinkSourceItems,
    setLinkActionError: input.setLinkActionError,
    setLinkReturnTo: input.setLinkReturnTo,
    setOverviewLinkItems: input.setOverviewLinkSourceItems,
    setUpdatingCatalogLinkSlug: input.setUpdatingCatalogLinkSlug,
  });

  const calendarDisplay = createWorkspaceCalendarDisplayActions({
    getCommonCourseLabel: () => getCommonCopy().courses,
    getEventLabels: () => ({
      exam: input.getCopy().CalendarEventCard.exam,
      homework: input.getCopy().CalendarEventCard.homework,
      todo: input.getCopy().CalendarEventCard.todo,
    }),
    getTodoPriorityLabel: (priority) => getTodosCopy().priority[priority],
    getWeekNumberTemplate: () => getSectionCopy().weekNumber,
    tabHref: workspaceTabHref,
  });

  const calendar = createWorkspaceCalendarActions({
    getCalendarData: input.getCalendarData,
    getCalendarMonth: input.getCalendarMonth,
    getCalendarSemesterId: input.getCalendarSemesterId,
    getCalendarView: input.getCalendarView,
    getCalendarWeekStart: input.getCalendarWeekStart,
    navigateUrl: (href) => {
      void goto(href, { noScroll: true, replaceState: true });
    },
    replaceUrl: (href) => {
      window.history.replaceState({}, "", href);
    },
    setCalendarMonth: input.setCalendarMonth,
    setCalendarSemesterId: input.setCalendarSemesterId,
    setCalendarView: input.setCalendarView,
    setCalendarWeekStart: input.setCalendarWeekStart,
    tabHref: workspaceTabHref,
  });

  function mount() {
    return mountWorkspaceController({
      applyViewState: applyWorkspaceViewState,
      clearPendingRemoveSection: subscription.clearPendingRemoveSection,
      copy: {
        workspace: getWorkspaceCopy(),
      },
      getLinkSearchInput: input.getLinkSearchInput,
      replaceState: (href) => {
        replaceState(href, {});
      },
      setLinkActionError: input.setLinkActionError,
      setLinkReturnTo: input.setLinkReturnTo,
    });
  }

  return {
    ...createHomework,
    ...todo,
    ...display,
    ...form,
    ...subscription,
    ...homework,
    ...link,
    ...calendarDisplay,
    ...calendar,
    applyWorkspaceViewState,
    mount,
    openTodoEditor,
  };
}
