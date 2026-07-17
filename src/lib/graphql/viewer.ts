import { getCompactOverview } from "@/features/dashboard/server/compact-overview-read-model";
import { findAuthenticatedUserProfileById } from "@/features/profile/server/profile-read-model";
import {
  listSubscribedExamPage,
  listSubscribedHomeworkPage,
  listSubscribedSchedulePage,
  listSubscribedSectionPage,
} from "@/features/subscriptions/server/subscription-read-model";
import {
  listTodoPage,
  type TodoListFilters,
} from "@/features/todos/server/todo-service";
import {
  GraphqlAuthError,
  type GraphqlScopeRequirement,
  requireGraphqlScope,
} from "./auth";
import type { GraphqlContext } from "./context";
import {
  validateGraphqlWeekday,
  validateOptionalGraphqlId,
} from "./input-boundaries";
import {
  type GraphqlPageInput,
  graphqlPageResolvers,
  normalizeGraphqlPage,
  paginateGraphqlArray,
} from "./pagination";
import {
  normalizeGraphqlShanghaiCalendarDate,
  parseGraphqlDateTimeInstant,
  validateGraphqlDateRange,
} from "./viewer-input";

type ViewerParent = { userId: string };

type TodoFilterInput = {
  completed?: boolean | null;
  dueAfter?: string | null;
  dueBefore?: string | null;
  priority?: TodoListFilters["priority"] | null;
};

type HomeworkFilterInput = {
  completed?: boolean | null;
  dueAtFrom?: string | null;
  dueAtTo?: string | null;
  semesterId?: number | null;
};

type ScheduleFilterInput = {
  dateFrom?: string | null;
  dateTo?: string | null;
  semesterId?: number | null;
  weekday?: number | null;
};

type ExamFilterInput = {
  dateFrom?: string | null;
  dateTo?: string | null;
  includeDateUnknown?: boolean | null;
  semesterId?: number | null;
};

type HomeworkParent = {
  completion?: { completedAt: Date } | null;
};

type ScheduleParent = {
  teachers: readonly unknown[];
};

type ExamParent = {
  examRooms: readonly unknown[];
};

type OverviewParent = Awaited<ReturnType<typeof getCompactOverview>>;

const READ_SCOPES = {
  profile: { feature: "me", action: "read" },
  overview: { feature: "dashboard", action: "read" },
  todos: { feature: "todo", action: "read" },
  subscribedSections: { feature: "subscription", action: "read" },
  homeworks: { feature: "homework", action: "read" },
  schedules: { feature: "schedule", action: "read" },
  exams: { feature: "exam", action: "read" },
} as const satisfies Record<string, GraphqlScopeRequirement>;

function requireViewerUserId(
  context: GraphqlContext,
  requirement: GraphqlScopeRequirement,
) {
  return requireGraphqlScope(context.principal, requirement).userId;
}

function optionalInstant(value: string | null | undefined, field: string) {
  return value == null ? undefined : parseGraphqlDateTimeInstant(value, field);
}

function optionalShanghaiDate(value: string | null | undefined, field: string) {
  return value == null
    ? undefined
    : normalizeGraphqlShanghaiCalendarDate(value, field);
}

function instantRange(
  from: string | null | undefined,
  to: string | null | undefined,
  fromField: string,
  toField: string,
) {
  const dateFrom = optionalInstant(from, fromField);
  const dateTo = optionalInstant(to, toField);
  validateGraphqlDateRange(dateFrom, dateTo);
  return { dateFrom, dateTo };
}

function shanghaiDateRange(
  from: string | null | undefined,
  to: string | null | undefined,
  fromField: string,
  toField: string,
) {
  const dateFrom = optionalShanghaiDate(from, fromField);
  const dateTo = optionalShanghaiDate(to, toField);
  validateGraphqlDateRange(dateFrom, dateTo);
  return { dateFrom, dateTo };
}

export const graphqlViewerTypeDefs = /* GraphQL */ `
  enum TodoPriority {
    LOW
    MEDIUM
    HIGH
  }

  input TodoFilter {
    completed: Boolean
    priority: TodoPriority
    dueAfter: DateTime
    dueBefore: DateTime
  }

  input HomeworkFilter {
    completed: Boolean
    dueAtFrom: DateTime
    dueAtTo: DateTime
    semesterId: Int
  }

  input ScheduleFilter {
    dateFrom: DateTime
    dateTo: DateTime
    weekday: Int
    semesterId: Int
  }

  input ExamFilter {
    dateFrom: DateTime
    dateTo: DateTime
    includeDateUnknown: Boolean = true
    semesterId: Int
  }

  type UserProfile {
    id: ID!
    email: String!
    username: String
    name: String!
    image: String
    isAdmin: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type ViewerOverview {
    atTime: DateTime!
    today: Date!
    homeworkWindowEnd: DateTime!
    incompleteTodos: Int!
    completedTodos: Int!
    overdueTodos: Int!
    pendingHomeworks: Int!
    dueSoonHomeworks: Int!
    todaySchedules: Int!
    upcomingExams: Int!
  }

  type Todo {
    id: ID!
    title: String!
    content: String
    priority: TodoPriority!
    completed: Boolean!
    dueAt: DateTime
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type TodoPage {
    items: [Todo!]!
    pageInfo: PageInfo!
  }

  type Homework {
    id: ID!
    title: String!
    isMajor: Boolean!
    requiresTeam: Boolean!
    publishedAt: DateTime
    submissionStartAt: DateTime
    submissionDueAt: DateTime
    createdAt: DateTime!
    updatedAt: DateTime!
    completed: Boolean!
    completedAt: DateTime
    commentCount: Int!
    section: Section!
  }

  type HomeworkPage {
    items: [Homework!]!
    pageInfo: PageInfo!
  }

  type ScheduleRoom {
    id: Int!
    jwId: Int!
    code: String!
    nameCn: String!
    nameEn: String
  }

  type ScheduleGroup {
    id: Int!
    jwId: Int!
    no: Int!
    isDefault: Boolean!
  }

  type Schedule {
    id: Int!
    periods: Int!
    date: Date
    weekday: Int!
    startTime: Int!
    endTime: Int!
    experiment: String
    customPlace: String
    lessonType: String
    weekIndex: Int!
    startUnit: Int!
    endUnit: Int!
    room: ScheduleRoom
    teachers(page: PageInput): TeacherPage!
    scheduleGroup: ScheduleGroup!
    section: Section!
  }

  type SchedulePage {
    items: [Schedule!]!
    pageInfo: PageInfo!
  }

  type ExamBatch {
    id: Int!
    nameCn: String!
    nameEn: String
  }

  type ExamRoom {
    id: Int!
    room: String!
    count: Int!
  }

  type ExamRoomPage {
    items: [ExamRoom!]!
    pageInfo: PageInfo!
  }

  type Exam {
    id: Int!
    jwId: Int!
    examType: Int
    startTime: Int
    endTime: Int
    examDate: Date
    examTakeCount: Int
    examMode: String
    examBatch: ExamBatch
    examRooms(page: PageInput): ExamRoomPage!
    section: Section!
  }

  type ExamPage {
    items: [Exam!]!
    pageInfo: PageInfo!
  }

  type Viewer {
    profile: UserProfile!
    overview(atTime: DateTime): ViewerOverview!
    todos(filter: TodoFilter, page: PageInput): TodoPage!
    subscribedSections(page: PageInput): SectionPage!
    homeworks(filter: HomeworkFilter, page: PageInput): HomeworkPage!
    schedules(filter: ScheduleFilter, page: PageInput): SchedulePage!
    exams(filter: ExamFilter, page: PageInput): ExamPage!
  }
`;

export function graphqlViewerQueryResolver(
  _parent: unknown,
  _args: unknown,
  context: GraphqlContext,
) {
  return context.principal.kind === "anonymous"
    ? null
    : { userId: context.principal.userId };
}

export const graphqlViewerResolvers = {
  TodoPriority: {
    LOW: "low",
    MEDIUM: "medium",
    HIGH: "high",
  },
  TodoPage: graphqlPageResolvers,
  HomeworkPage: graphqlPageResolvers,
  SchedulePage: graphqlPageResolvers,
  ExamPage: graphqlPageResolvers,
  ExamRoomPage: graphqlPageResolvers,
  Homework: {
    completed: (homework: HomeworkParent) => Boolean(homework.completion),
    completedAt: (homework: HomeworkParent) =>
      homework.completion?.completedAt ?? null,
  },
  Schedule: {
    teachers(
      schedule: ScheduleParent,
      args: { page?: GraphqlPageInput | null },
    ) {
      return paginateGraphqlArray(schedule.teachers, args.page);
    },
  },
  Exam: {
    examRooms(exam: ExamParent, args: { page?: GraphqlPageInput | null }) {
      return paginateGraphqlArray(exam.examRooms, args.page);
    },
  },
  ViewerOverview: {
    atTime: (overview: OverviewParent) => overview.anchor.atTime,
    today: (overview: OverviewParent) => overview.anchor.todayStart,
    homeworkWindowEnd: (overview: OverviewParent) =>
      overview.anchor.homeworkWindowEnd,
    incompleteTodos: (overview: OverviewParent) =>
      overview.counts.todos.incomplete,
    completedTodos: (overview: OverviewParent) =>
      overview.counts.todos.completed,
    overdueTodos: (overview: OverviewParent) => overview.counts.todos.overdue,
    pendingHomeworks: (overview: OverviewParent) =>
      overview.counts.pendingHomeworks,
    dueSoonHomeworks: (overview: OverviewParent) =>
      overview.counts.dueSoonHomeworks,
    todaySchedules: (overview: OverviewParent) =>
      overview.counts.todaySchedules,
    upcomingExams: (overview: OverviewParent) => overview.counts.upcomingExams,
  },
  Viewer: {
    async profile(
      _viewer: ViewerParent,
      _args: unknown,
      context: GraphqlContext,
    ) {
      const userId = requireViewerUserId(context, READ_SCOPES.profile);
      const profile = await findAuthenticatedUserProfileById(userId);
      if (!profile) {
        throw new GraphqlAuthError(
          "Authenticated user not found",
          "UNAUTHENTICATED",
          401,
        );
      }
      return profile;
    },
    overview(
      _viewer: ViewerParent,
      args: { atTime?: string | null },
      context: GraphqlContext,
    ) {
      const userId = requireViewerUserId(context, READ_SCOPES.overview);
      return getCompactOverview(userId, {
        atTime: optionalInstant(args.atTime, "atTime"),
        locale: context.locale,
      });
    },
    todos(
      _viewer: ViewerParent,
      args: {
        filter?: TodoFilterInput | null;
        page?: GraphqlPageInput | null;
      },
      context: GraphqlContext,
    ) {
      const userId = requireViewerUserId(context, READ_SCOPES.todos);
      const { dateFrom: dueAfter, dateTo: dueBefore } = instantRange(
        args.filter?.dueAfter,
        args.filter?.dueBefore,
        "dueAfter",
        "dueBefore",
      );
      const filters: TodoListFilters = {
        ...(args.filter?.completed != null
          ? { completed: args.filter.completed }
          : {}),
        ...(args.filter?.priority != null
          ? { priority: args.filter.priority }
          : {}),
        ...(dueAfter ? { dueAfter } : {}),
        ...(dueBefore ? { dueBefore } : {}),
      };
      return listTodoPage({
        filters,
        pagination: normalizeGraphqlPage(args.page),
        userId,
      });
    },
    subscribedSections(
      _viewer: ViewerParent,
      args: { page?: GraphqlPageInput | null },
      context: GraphqlContext,
    ) {
      const userId = requireViewerUserId(
        context,
        READ_SCOPES.subscribedSections,
      );
      return listSubscribedSectionPage(userId, {
        locale: context.locale,
        pagination: normalizeGraphqlPage(args.page),
      });
    },
    homeworks(
      _viewer: ViewerParent,
      args: {
        filter?: HomeworkFilterInput | null;
        page?: GraphqlPageInput | null;
      },
      context: GraphqlContext,
    ) {
      const userId = requireViewerUserId(context, READ_SCOPES.homeworks);
      const { dateFrom: dueAtFrom, dateTo: dueAtTo } = instantRange(
        args.filter?.dueAtFrom,
        args.filter?.dueAtTo,
        "dueAtFrom",
        "dueAtTo",
      );
      return listSubscribedHomeworkPage(userId, {
        ...(args.filter?.completed != null
          ? { completed: args.filter.completed }
          : {}),
        dueAtFrom,
        dueAtTo,
        locale: context.locale,
        pagination: normalizeGraphqlPage(args.page),
        semesterId: validateOptionalGraphqlId(
          args.filter?.semesterId,
          "semesterId",
        ),
      });
    },
    schedules(
      _viewer: ViewerParent,
      args: {
        filter?: ScheduleFilterInput | null;
        page?: GraphqlPageInput | null;
      },
      context: GraphqlContext,
    ) {
      const userId = requireViewerUserId(context, READ_SCOPES.schedules);
      const { dateFrom, dateTo } = shanghaiDateRange(
        args.filter?.dateFrom,
        args.filter?.dateTo,
        "dateFrom",
        "dateTo",
      );
      return listSubscribedSchedulePage(userId, {
        dateFrom,
        dateTo,
        locale: context.locale,
        pagination: normalizeGraphqlPage(args.page),
        semesterId: validateOptionalGraphqlId(
          args.filter?.semesterId,
          "semesterId",
        ),
        weekday: validateGraphqlWeekday(args.filter?.weekday),
      });
    },
    exams(
      _viewer: ViewerParent,
      args: {
        filter?: ExamFilterInput | null;
        page?: GraphqlPageInput | null;
      },
      context: GraphqlContext,
    ) {
      const userId = requireViewerUserId(context, READ_SCOPES.exams);
      const { dateFrom, dateTo } = shanghaiDateRange(
        args.filter?.dateFrom,
        args.filter?.dateTo,
        "dateFrom",
        "dateTo",
      );
      return listSubscribedExamPage(userId, {
        dateFrom,
        dateTo,
        includeDateUnknown: args.filter?.includeDateUnknown ?? true,
        locale: context.locale,
        pagination: normalizeGraphqlPage(args.page),
        semesterId: validateOptionalGraphqlId(
          args.filter?.semesterId,
          "semesterId",
        ),
      });
    },
  },
};
