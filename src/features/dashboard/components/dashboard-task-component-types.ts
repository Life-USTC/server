import type { SubmitFunction } from "@sveltejs/kit";
import type { CommentsCopy } from "@/features/comments/components/comment-component-types";
import type {
  DashboardCommonCopy,
  DashboardDashboardCopy,
  DashboardHomeworkItem,
  DashboardHomeworksCopy,
  DashboardMyHomeworksCopy,
  DashboardPageData,
  DashboardSectionCopy,
  DashboardSubscriptionsCopy,
  DashboardTodoItem,
  DashboardTodoPriorityOption,
  DashboardTodosCopy,
  ExamView,
  HomeworkFilter,
  HomeworkView,
  SignedDashboardData,
  TodoFilter,
  TodoView,
} from "@/features/dashboard/lib/dashboard-controller-helpers";
import type { SignedTabId } from "@/features/dashboard/lib/dashboard-nav";
import type {
  DashboardExamFilter,
  DashboardExamRow,
  DashboardTabHref,
  ExamMetadataLabels,
  ExamTimeLabel,
  NamePrimary,
} from "./dashboard-exam-component-types";
import type { DashboardHomeworkCreateSectionGetter } from "./dashboard-homework-create-types";

export type DashboardTaskActiveTab = SignedTabId;
export type DashboardTaskDateValue = Date | string;
export type DashboardTaskShortcut = () => void;
export type DashboardTaskStringDraft = string;
export type DashboardTaskSavingById = Record<string, boolean>;
export type DashboardTaskHomeworksCopy = DashboardHomeworksCopy & {
  markComplete: string;
  markIncomplete: string;
};
export type DashboardTaskHomeworkCopy = DashboardMyHomeworksCopy;

export type DashboardHomeworkToggle = (
  homework: DashboardHomeworkItem,
) => void | Promise<void>;

export type DashboardTodoToggle = (
  todo: DashboardTodoItem,
) => void | Promise<void>;

export type DashboardTodoAction = (
  todo: DashboardTodoItem,
) => void | Promise<void>;

export type DashboardTodoEditor = (todo: DashboardTodoItem) => void;

export type DashboardTodoPriorityClass = (
  priority: DashboardTodoItem["priority"],
) => string;

export type DashboardTaskBaseProps = {
  commentsCopy: CommentsCopy;
  dashboardCopy: DashboardDashboardCopy;
  data: DashboardPageData;
  homeworkReferenceDate: DashboardTaskDateValue;
  sectionCopy: DashboardSectionCopy;
};

export type DashboardHomeworksTaskProps = DashboardTaskBaseProps & {
  applyHomeworkDueAtSemesterEnd: DashboardTaskShortcut;
  applyHomeworkDueInMonth: DashboardTaskShortcut;
  applyHomeworkDueInWeek: DashboardTaskShortcut;
  applyHomeworkStartNow: DashboardTaskShortcut;
  commonCopy: DashboardCommonCopy;
  createHomeworkAction: SubmitFunction;
  createHomeworkAdvancedOpen: boolean;
  createHomeworkError: string;
  createHomeworkPublishedAt: DashboardTaskStringDraft;
  createHomeworkSectionId: DashboardTaskStringDraft;
  createHomeworkSubmissionDueAt: DashboardTaskStringDraft;
  createHomeworkSubmissionStartAt: DashboardTaskStringDraft;
  homeworkCopy: DashboardTaskHomeworkCopy;
  homeworkDescriptionMaxLength: number;
  homeworkFilter: HomeworkFilter;
  homeworkItems: DashboardHomeworkItem[];
  homeworkSavingById: DashboardTaskSavingById;
  homeworkTitleMaxLength: number;
  homeworkView: HomeworkView;
  homeworksCopy: DashboardTaskHomeworksCopy;
  isCreatingHomework: boolean;
  openCreateHomeworkDialog: () => void;
  selectedCreateHomeworkSection: DashboardHomeworkCreateSectionGetter;
  selectedHomework: DashboardHomeworkItem | null;
  setHomeworkView: (view: HomeworkView) => void;
  showCreateHomework: boolean;
  signedData: SignedDashboardData;
  toggleHomeworkCompletion: DashboardHomeworkToggle;
};

export type DashboardTodosTaskProps = DashboardTaskBaseProps & {
  createTodoAction: SubmitFunction;
  createTodoError: string;
  deleteTodo: DashboardTodoAction;
  editTodoError: string;
  editingTodo: DashboardTodoItem | null;
  filteredTodos: DashboardTodoItem[];
  isCreatingTodo: boolean;
  isUpdatingTodo: boolean;
  openTodoEditor: DashboardTodoEditor;
  selectedTodo: DashboardTodoItem | null;
  setTodoView: (view: TodoView) => void;
  showCreateTodo: boolean;
  todoActionError: string;
  todoContentMaxLength: number;
  todoFilter: TodoFilter;
  todoPriorityClass: DashboardTodoPriorityClass;
  todoPriorityOptions: DashboardTodoPriorityOption[];
  todoSavingById: DashboardTaskSavingById;
  todoTitleMaxLength: number;
  todoView: TodoView;
  todosCopy: DashboardTodosCopy;
  toggleTodoCompletion: DashboardTodoToggle;
  updateTodoAction: SubmitFunction;
};

export type DashboardExamsTaskProps = {
  dashboardCopy: DashboardDashboardCopy;
  dashboardTabHref: DashboardTabHref;
  examFilter: DashboardExamFilter;
  examMetadataLabels: ExamMetadataLabels;
  examRows: DashboardExamRow[];
  examTimeLabel: ExamTimeLabel;
  examView: ExamView;
  filteredExamRows: DashboardExamRow[];
  namePrimary: NamePrimary;
  sectionCopy: DashboardSectionCopy;
  setExamView: (view: ExamView) => void;
  signedData: SignedDashboardData;
  subscriptionsCopy: DashboardSubscriptionsCopy;
};

export type DashboardTaskTabsProps = DashboardHomeworksTaskProps &
  DashboardTodosTaskProps &
  DashboardExamsTaskProps & {
    activeTab: DashboardTaskActiveTab;
  };
