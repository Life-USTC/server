import type { SubmitFunction } from "@sveltejs/kit";
import type { CommentsCopy } from "@/features/comments/components/comment-component-types";
import type {
  ExamView,
  HomeworkFilter,
  HomeworkView,
  SignedWorkspaceData,
  TodoFilter,
  WorkspaceCommonCopy,
  WorkspaceCopy,
  WorkspaceHomeworkItem,
  WorkspaceHomeworksCopy,
  WorkspaceMyHomeworksCopy,
  WorkspacePageData,
  WorkspaceSectionCopy,
  WorkspaceSubscriptionsCopy,
  WorkspaceTodoItem,
  WorkspaceTodoPriorityOption,
  WorkspaceTodosCopy,
} from "@/features/workspace/lib/workspace-controller-helpers";
import type { WorkspaceTabId } from "@/features/workspace/lib/workspace-nav";
import type {
  ExamMetadataLabels,
  ExamTimeLabel,
  NamePrimary,
  WorkspaceExamFilter,
  WorkspaceExamRow,
  WorkspaceTabHref,
} from "./workspace-exam-component-types";
import type { WorkspaceHomeworkCreateSectionGetter } from "./workspace-homework-create-types";

export type WorkspaceTaskActiveTab = WorkspaceTabId;
export type WorkspaceTaskDateValue = Date | string;
export type WorkspaceTaskShortcut = () => void;
export type WorkspaceTaskStringDraft = string;
export type WorkspaceTaskSavingById = Record<string, boolean>;
export type WorkspaceTaskHomeworksCopy = WorkspaceHomeworksCopy & {
  markComplete: string;
  markIncomplete: string;
};
export type WorkspaceTaskHomeworkCopy = WorkspaceMyHomeworksCopy;

export type WorkspaceHomeworkToggle = (
  homework: WorkspaceHomeworkItem,
) => void | Promise<void>;

export type WorkspaceTodoToggle = (
  todo: WorkspaceTodoItem,
) => void | Promise<void>;

export type WorkspaceTodoAction = (
  todo: WorkspaceTodoItem,
) => void | Promise<void>;

export type WorkspaceTodoEditor = (todo: WorkspaceTodoItem) => void;

export type WorkspaceTaskBaseProps = {
  commentsCopy: CommentsCopy;
  workspaceCopy: WorkspaceCopy;
  data: WorkspacePageData;
  homeworkReferenceDate: WorkspaceTaskDateValue;
  sectionCopy: WorkspaceSectionCopy;
};

export type WorkspaceHomeworksTaskProps = WorkspaceTaskBaseProps & {
  applyHomeworkDueAtSemesterEnd: WorkspaceTaskShortcut;
  applyHomeworkDueInMonth: WorkspaceTaskShortcut;
  applyHomeworkDueInWeek: WorkspaceTaskShortcut;
  applyHomeworkStartNow: WorkspaceTaskShortcut;
  commonCopy: WorkspaceCommonCopy;
  createHomeworkAction: SubmitFunction;
  createHomeworkAdvancedOpen: boolean;
  createHomeworkError: string;
  createHomeworkPublishedAt: WorkspaceTaskStringDraft;
  createHomeworkSectionId: WorkspaceTaskStringDraft;
  createHomeworkSubmissionDueAt: WorkspaceTaskStringDraft;
  createHomeworkSubmissionStartAt: WorkspaceTaskStringDraft;
  homeworkActionError: string;
  homeworkCopy: WorkspaceTaskHomeworkCopy;
  homeworkFilter: HomeworkFilter;
  homeworkItems: WorkspaceHomeworkItem[];
  homeworkSavingById: WorkspaceTaskSavingById;
  homeworkView: HomeworkView;
  homeworksCopy: WorkspaceTaskHomeworksCopy;
  isCreatingHomework: boolean;
  openCreateHomeworkDialog: () => void;
  selectedCreateHomeworkSection: WorkspaceHomeworkCreateSectionGetter;
  selectedHomework: WorkspaceHomeworkItem | null;
  setHomeworkView: (view: HomeworkView) => void;
  showCreateHomework: boolean;
  signedData: SignedWorkspaceData;
  toggleHomeworkCompletion: WorkspaceHomeworkToggle;
};

export type WorkspaceTodosTaskProps = WorkspaceTaskBaseProps & {
  createTodoAction: SubmitFunction;
  createTodoError: string;
  deleteTodo: WorkspaceTodoAction;
  editTodoError: string;
  editingTodo: WorkspaceTodoItem | null;
  filteredTodos: WorkspaceTodoItem[];
  isCreatingTodo: boolean;
  isUpdatingTodo: boolean;
  openTodoEditor: WorkspaceTodoEditor;
  selectedTodo: WorkspaceTodoItem | null;
  showCreateTodo: boolean;
  todoActionError: string;
  todoFilter: TodoFilter;
  todoItems: WorkspaceTodoItem[];
  todoPriorityOptions: WorkspaceTodoPriorityOption[];
  todoSavingById: WorkspaceTaskSavingById;
  todosCopy: WorkspaceTodosCopy;
  toggleTodoCompletion: WorkspaceTodoToggle;
  updateTodoAction: SubmitFunction;
};

export type WorkspaceExamsTaskProps = {
  workspaceCopy: WorkspaceCopy;
  workspaceTabHref: WorkspaceTabHref;
  examFilter: WorkspaceExamFilter;
  examMetadataLabels: ExamMetadataLabels;
  examRows: WorkspaceExamRow[];
  examTimeLabel: ExamTimeLabel;
  examView: ExamView;
  filteredExamRows: WorkspaceExamRow[];
  namePrimary: NamePrimary;
  sectionCopy: WorkspaceSectionCopy;
  setExamView: (view: ExamView) => void;
  signedData: SignedWorkspaceData;
  subscriptionsCopy: WorkspaceSubscriptionsCopy;
};

export type WorkspaceTaskTabsProps = WorkspaceHomeworksTaskProps &
  WorkspaceTodosTaskProps &
  WorkspaceExamsTaskProps & {
    activeTab: WorkspaceTaskActiveTab;
  };
