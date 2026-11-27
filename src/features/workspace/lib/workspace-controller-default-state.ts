import type { CalendarView } from "@/features/workspace/lib/calendar";
import type {
  HomeworkItem,
  MatchedSection,
  TodoItem,
} from "@/features/workspace/lib/workspace-controller-helpers";

export function createWorkspaceControllerDefaultState() {
  return {
    bulkImportError: "",
    bulkImportMessage: "",
    bulkImportSemesterId: "",
    bulkImportText: "",
    calendarDay: "",
    calendarMonth: "",
    calendarSemesterId: null as number | null,
    calendarView: "semester" as CalendarView,
    calendarWeekStart: "",
    createHomeworkAdvancedOpen: false,
    createHomeworkError: "",
    createHomeworkPublishedAt: "",
    createHomeworkSectionId: "",
    createHomeworkSubmissionDueAt: "",
    createHomeworkSubmissionStartAt: "",
    createTodoError: "",
    editTodoError: "",
    editingTodo: null as TodoItem | null,
    homeworkActionError: "",
    homeworkSavingById: {} as Record<string, boolean>,
    isBulkImportOpen: false,
    isConfirmImportOpen: false,
    isCreatingHomework: false,
    isCreatingTodo: false,
    isImportingSections: false,
    isMatchingSections: false,
    isUpdatingTodo: false,
    linkActionError: "",
    linkReturnTo: "/catalog/links",
    linkSearchQuery: "",
    matchedSections: [] as MatchedSection[],
    removingSectionId: null as number | null,
    selectedHomework: null as HomeworkItem | null,
    selectedImportSectionIds: [] as number[],
    selectedTodo: null as TodoItem | null,
    showCreateHomework: false,
    showCreateTodo: false,
    subscriptionActionError: "",
    todoActionError: "",
    todoSavingById: {} as Record<string, boolean>,
    unmatchedSectionCodes: [] as string[],
    updatingCatalogLinkSlug: null as string | null,
  };
}

export type WorkspaceControllerState = ReturnType<
  typeof createWorkspaceControllerDefaultState
>;
