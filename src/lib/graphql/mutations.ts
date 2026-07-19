import type { BusPreferencePayload } from "@/features/bus/lib/bus-types";
import { saveBusPreference } from "@/features/bus/server/bus-service";
import {
  createComment,
  createCommentReaction,
  deleteCommentReaction,
  deleteOwnComment,
  updateOwnComment,
} from "@/features/comments/server/comment-mutations";
import {
  MAX_PINNED_LINKS,
  resolveDashboardLinkBySlug,
  updateDashboardLinkPinState,
} from "@/features/dashboard-links/server/dashboard-link-service";
import { DESCRIPTION_CONTENT_MAX_LENGTH } from "@/features/descriptions/lib/description-limits";
import {
  type DescriptionTargetType,
  resolveDescriptionTargetReference,
} from "@/features/descriptions/server/description-targets";
import { upsertDescriptionContent } from "@/features/descriptions/server/description-upsert";
import { setHomeworkCompletion } from "@/features/homeworks/server/homework-completion";
import { setUserSectionSubscriptionByJwId } from "@/features/subscriptions/server/subscriptions";
import type { TodoPriorityValue } from "@/features/todos/lib/todo-priority";
import {
  createTodo,
  deleteOwnedTodo,
  updateOwnedTodo,
} from "@/features/todos/server/todo-service";
import type {
  CommentReactionType,
  CommentVisibility,
} from "@/generated/prisma/client";
import { getAuditRequestMetadata } from "@/lib/audit/write-audit-log";
import type { GraphqlContext } from "./context";
import {
  requireGraphqlId,
  validateOptionalGraphqlId,
} from "./input-boundaries";
import {
  badMutationInput,
  forbiddenMutation,
  mutationNotFound,
} from "./mutation-errors";
import { requireGraphqlMutation } from "./mutation-guard";
import {
  commentReactionTypeResolver,
  commentTargetTypeResolver,
  commentVisibilityResolver,
  dateTimeInput,
  normalizeCommentBody,
  normalizeIdList,
  normalizeTodoContent,
  normalizeTodoTitle,
  rejectExplicitNullFields,
  requireMutationId,
} from "./mutation-input";

export const graphqlMutationTypeDefs = /* GraphQL */ `
  enum DescriptionTargetType {
    COURSE
    SECTION
    TEACHER
    HOMEWORK
  }

  enum CommentVisibility {
    PUBLIC
    LOGGED_IN_ONLY
  }

  enum CommentReactionType {
    UPVOTE
    DOWNVOTE
    HEART
    LAUGH
    HOORAY
    CONFUSED
    ROCKET
    EYES
  }

  enum CommentTargetType {
    COURSE
    SECTION
    TEACHER
    SECTION_TEACHER
    HOMEWORK
  }

  input CreateTodoInput {
    title: String!
    content: String
    priority: TodoPriority = MEDIUM
    dueAt: DateTime
  }

  input UpdateTodoInput {
    title: String
    content: String
    priority: TodoPriority
    dueAt: DateTime
    completed: Boolean
  }

  input BusPreferenceInput {
    preferredOriginCampusId: Int
    preferredDestinationCampusId: Int
    showDepartedTrips: Boolean!
  }

  input UpsertDescriptionInput {
    targetType: DescriptionTargetType!
    targetId: ID
    sectionJwId: Int
    courseJwId: Int
    teacherId: Int
    homeworkId: ID
    content: String!
  }

  input CreateCommentInput {
    targetType: CommentTargetType!
    targetId: ID
    sectionId: ID
    sectionJwId: Int
    courseJwId: Int
    teacherId: ID
    homeworkId: ID
    sectionTeacherId: Int
    body: String!
    visibility: CommentVisibility = PUBLIC
    isAnonymous: Boolean = false
    parentId: ID
    attachmentIds: [ID!]
  }

  input UpdateCommentInput {
    body: String!
    visibility: CommentVisibility
    isAnonymous: Boolean
    attachmentIds: [ID!]
  }

  type TodoMutationPayload {
    id: ID!
  }

  type DeleteMutationPayload {
    id: ID!
    success: Boolean!
  }

  type HomeworkCompletionMutationPayload {
    homeworkId: ID!
    completed: Boolean!
    completedAt: DateTime
  }

  type SectionSubscriptionMutationPayload {
    sectionJwId: Int!
    subscribed: Boolean!
  }

  type DashboardLinkPinMutationPayload {
    slug: String!
    pinned: Boolean!
    pinnedSlugs: [String!]!
    maxPinnedLinks: Int!
  }

  type BusPreferenceMutationPayload {
    preferredOriginCampusId: Int
    preferredDestinationCampusId: Int
    showDepartedTrips: Boolean!
  }

  type CommentMutationPayload {
    id: ID!
  }

  type DescriptionMutationPayload {
    id: ID!
    updated: Boolean!
  }

  type CommentReactionMutationPayload {
    commentId: ID!
    type: CommentReactionType!
    active: Boolean!
    changed: Boolean!
  }

  type Mutation {
    createTodo(input: CreateTodoInput!): TodoMutationPayload!
    updateTodo(id: ID!, input: UpdateTodoInput!): TodoMutationPayload!
    deleteTodo(id: ID!): DeleteMutationPayload!
    setHomeworkCompletion(
      homeworkId: ID!
      completed: Boolean!
    ): HomeworkCompletionMutationPayload!
    subscribeSection(jwId: Int!): SectionSubscriptionMutationPayload!
    unsubscribeSection(jwId: Int!): SectionSubscriptionMutationPayload!
    setDashboardLinkPinState(
      slug: String!
      pinned: Boolean!
    ): DashboardLinkPinMutationPayload!
    saveBusPreferences(
      input: BusPreferenceInput!
    ): BusPreferenceMutationPayload!
    upsertDescription(
      input: UpsertDescriptionInput!
    ): DescriptionMutationPayload!
    createComment(input: CreateCommentInput!): CommentMutationPayload!
    updateComment(
      id: ID!
      input: UpdateCommentInput!
    ): CommentMutationPayload!
    deleteComment(id: ID!): DeleteMutationPayload!
    addCommentReaction(
      commentId: ID!
      type: CommentReactionType!
    ): CommentReactionMutationPayload!
    removeCommentReaction(
      commentId: ID!
      type: CommentReactionType!
    ): CommentReactionMutationPayload!
  }
`;

type CreateTodoInput = {
  content?: string | null;
  dueAt?: string | null;
  priority?: TodoPriorityValue | null;
  title: string;
};

type UpdateTodoInput = {
  completed?: boolean | null;
  content?: string | null;
  dueAt?: string | null;
  priority?: TodoPriorityValue | null;
  title?: string | null;
};

type CommentTargetTypeInput =
  (typeof commentTargetTypeResolver)[keyof typeof commentTargetTypeResolver];

type CreateCommentInput = {
  attachmentIds?: string[] | null;
  body: string;
  courseJwId?: number | null;
  homeworkId?: string | null;
  isAnonymous?: boolean | null;
  parentId?: string | null;
  sectionId?: string | null;
  sectionJwId?: number | null;
  sectionTeacherId?: number | null;
  targetId?: string | null;
  targetType: CommentTargetTypeInput;
  teacherId?: string | null;
  visibility?: CommentVisibility | null;
};

type UpdateCommentInput = {
  attachmentIds?: string[] | null;
  body: string;
  isAnonymous?: boolean | null;
  visibility?: CommentVisibility | null;
};

type UpsertDescriptionInput = {
  content: string;
  courseJwId?: number | null;
  homeworkId?: string | null;
  sectionJwId?: number | null;
  targetId?: string | null;
  targetType: DescriptionTargetType;
  teacherId?: number | null;
};

const descriptionTargetTypeResolver = {
  COURSE: "course",
  SECTION: "section",
  TEACHER: "teacher",
  HOMEWORK: "homework",
} as const satisfies Record<string, DescriptionTargetType>;

function graphqlCommentAuditMetadata(request: Request) {
  return {
    ...getAuditRequestMetadata(request),
    source: "graphql",
  };
}

function handleTodoFailure(result: {
  error: "forbidden" | "no_changes" | "not_found";
}): never {
  if (result.error === "not_found") mutationNotFound("Todo not found.");
  if (result.error === "forbidden") forbiddenMutation();
  return badMutationInput("No todo changes were provided.");
}

function handleCommentFailure(result: { error: string }): never {
  if (
    result.error === "not_found" ||
    result.error === "parent_not_found" ||
    result.error === "target_not_found"
  ) {
    mutationNotFound("Comment target not found.");
  }
  if (result.error === "forbidden") forbiddenMutation();
  if (result.error === "locked") forbiddenMutation("Comment is locked.");
  if (result.error === "suspended") {
    forbiddenMutation("Comment writes are suspended.");
  }
  return badMutationInput("Invalid comment mutation.");
}

function handleDescriptionFailure(result: { error: string }): never {
  if (result.error === "not_found") {
    mutationNotFound("Description target not found.");
  }
  if (result.error === "invalid_target") {
    badMutationInput("Invalid description target.");
  }
  if (result.error === "suspended") {
    forbiddenMutation("Description writes are suspended.");
  }
  return forbiddenMutation();
}

async function setSectionSubscription(
  context: GraphqlContext,
  jwId: number,
  subscribed: boolean,
) {
  const principal = await requireGraphqlMutation(context, "subscription");
  const result = await setUserSectionSubscriptionByJwId({
    sectionJwId: requireGraphqlId(jwId, "jwId"),
    subscribed,
    userId: principal.userId,
  });
  if (!result) mutationNotFound("Section not found.");
  return result;
}

export const graphqlMutationResolvers = {
  CommentVisibility: commentVisibilityResolver,
  CommentReactionType: commentReactionTypeResolver,
  CommentTargetType: commentTargetTypeResolver,
  DescriptionTargetType: descriptionTargetTypeResolver,
  Mutation: {
    async createTodo(
      _parent: unknown,
      args: { input: CreateTodoInput },
      context: GraphqlContext,
    ) {
      const principal = await requireGraphqlMutation(context, "todo");
      rejectExplicitNullFields(args.input, ["priority"]);
      const todo = await createTodo({
        userId: principal.userId,
        title: normalizeTodoTitle(args.input.title),
        content: normalizeTodoContent(args.input.content),
        priority: args.input.priority ?? undefined,
        dueAt: dateTimeInput(args.input.dueAt),
      });
      return { id: todo.id };
    },
    async updateTodo(
      _parent: unknown,
      args: { id: string; input: UpdateTodoInput },
      context: GraphqlContext,
    ) {
      const principal = await requireGraphqlMutation(context, "todo");
      rejectExplicitNullFields(args.input, ["title", "priority", "completed"]);
      const hasContent = Object.hasOwn(args.input, "content");
      const hasDueAt = Object.hasOwn(args.input, "dueAt");
      const result = await updateOwnedTodo({
        id: requireMutationId(args.id, "id"),
        userId: principal.userId,
        data: {
          completed: args.input.completed ?? undefined,
          content: hasContent
            ? normalizeTodoContent(args.input.content)
            : undefined,
          dueAt: hasDueAt ? dateTimeInput(args.input.dueAt) : undefined,
          hasContent,
          hasDueAt,
          priority: args.input.priority ?? undefined,
          title:
            args.input.title == null
              ? undefined
              : normalizeTodoTitle(args.input.title),
        },
      });
      if (!result.ok) handleTodoFailure(result);
      return { id: result.todo.id };
    },
    async deleteTodo(
      _parent: unknown,
      args: { id: string },
      context: GraphqlContext,
    ) {
      const principal = await requireGraphqlMutation(context, "todo");
      const id = requireMutationId(args.id, "id");
      const result = await deleteOwnedTodo(id, principal.userId);
      if (!result.ok) handleTodoFailure(result);
      return { id, success: true };
    },
    async setHomeworkCompletion(
      _parent: unknown,
      args: { completed: boolean; homeworkId: string },
      context: GraphqlContext,
    ) {
      const principal = await requireGraphqlMutation(context, "homework");
      const result = await setHomeworkCompletion({
        completed: args.completed,
        homeworkId: requireMutationId(args.homeworkId, "homeworkId"),
        userId: principal.userId,
      });
      if (!result.success) mutationNotFound("Homework not found.");
      return result;
    },
    subscribeSection(
      _parent: unknown,
      args: { jwId: number },
      context: GraphqlContext,
    ) {
      return setSectionSubscription(context, args.jwId, true);
    },
    unsubscribeSection(
      _parent: unknown,
      args: { jwId: number },
      context: GraphqlContext,
    ) {
      return setSectionSubscription(context, args.jwId, false);
    },
    async setDashboardLinkPinState(
      _parent: unknown,
      args: { pinned: boolean; slug: string },
      context: GraphqlContext,
    ) {
      const principal = await requireGraphqlMutation(context, "dashboard");
      const link = resolveDashboardLinkBySlug(args.slug);
      if (!link) badMutationInput("Unknown dashboard link slug.");

      const pinnedSlugs = await updateDashboardLinkPinState({
        action: args.pinned ? "pin" : "unpin",
        slug: link.slug,
        userId: principal.userId,
      });
      return {
        slug: link.slug,
        pinned: pinnedSlugs.includes(link.slug),
        pinnedSlugs,
        maxPinnedLinks: MAX_PINNED_LINKS,
      };
    },
    async saveBusPreferences(
      _parent: unknown,
      args: { input: BusPreferencePayload },
      context: GraphqlContext,
    ) {
      const principal = await requireGraphqlMutation(context, "bus");
      const input = args.input;
      const result = await saveBusPreference(principal.userId, {
        preferredOriginCampusId:
          input.preferredOriginCampusId == null
            ? null
            : requireGraphqlId(
                input.preferredOriginCampusId,
                "preferredOriginCampusId",
              ),
        preferredDestinationCampusId:
          input.preferredDestinationCampusId == null
            ? null
            : requireGraphqlId(
                input.preferredDestinationCampusId,
                "preferredDestinationCampusId",
              ),
        showDepartedTrips: input.showDepartedTrips,
      });
      if (!result.ok) badMutationInput(result.error);
      return result.preference;
    },
    async upsertDescription(
      _parent: unknown,
      args: { input: UpsertDescriptionInput },
      context: GraphqlContext,
    ) {
      const principal = await requireGraphqlMutation(context, "description");
      const input = args.input;
      rejectExplicitNullFields(input, [
        "targetId",
        "sectionJwId",
        "courseJwId",
        "teacherId",
        "homeworkId",
      ]);
      if (input.content.length > DESCRIPTION_CONTENT_MAX_LENGTH) {
        badMutationInput(
          `content must not exceed ${DESCRIPTION_CONTENT_MAX_LENGTH} characters.`,
        );
      }
      const content = input.content.trim();

      const target = await resolveDescriptionTargetReference({
        courseJwId: validateOptionalGraphqlId(input.courseJwId, "courseJwId"),
        homeworkId:
          input.homeworkId == null
            ? undefined
            : requireMutationId(input.homeworkId, "homeworkId"),
        rawTargetId:
          input.targetId == null
            ? undefined
            : requireMutationId(input.targetId, "targetId"),
        sectionJwId: validateOptionalGraphqlId(
          input.sectionJwId,
          "sectionJwId",
        ),
        targetType: input.targetType,
        teacherId: validateOptionalGraphqlId(input.teacherId, "teacherId"),
        verifyExistence: true,
      });
      if (!target.ok) {
        if (target.error === "target_not_found") {
          mutationNotFound("Description target not found.");
        }
        badMutationInput("Invalid description target.");
      }

      const result = await upsertDescriptionContent({
        auditMetadata: {
          ...getAuditRequestMetadata(context.request),
          source: "graphql",
        },
        content,
        targetId: target.targetId,
        targetType: target.targetType,
        userId: principal.userId,
      });
      if (!result.ok) handleDescriptionFailure(result);
      return { id: result.id, updated: result.updated };
    },
    async createComment(
      _parent: unknown,
      args: { input: CreateCommentInput },
      context: GraphqlContext,
    ) {
      const principal = await requireGraphqlMutation(context, "comment");
      const input = args.input;
      rejectExplicitNullFields(input, [
        "targetId",
        "sectionId",
        "sectionJwId",
        "courseJwId",
        "teacherId",
        "homeworkId",
        "sectionTeacherId",
        "visibility",
        "isAnonymous",
        "attachmentIds",
      ]);
      const result = await createComment({
        attachmentIds:
          normalizeIdList(input.attachmentIds, "attachmentIds") ?? undefined,
        auditMetadata: graphqlCommentAuditMetadata(context.request),
        content: normalizeCommentBody(input.body),
        courseJwId:
          input.courseJwId == null
            ? undefined
            : requireGraphqlId(input.courseJwId, "courseJwId"),
        homeworkId:
          input.homeworkId == null
            ? undefined
            : requireMutationId(input.homeworkId, "homeworkId"),
        isAnonymous: input.isAnonymous === true,
        parentId:
          input.parentId == null
            ? input.parentId
            : requireMutationId(input.parentId, "parentId"),
        rawTargetId: input.targetId,
        sectionId: input.sectionId,
        sectionJwId:
          input.sectionJwId == null
            ? undefined
            : requireGraphqlId(input.sectionJwId, "sectionJwId"),
        sectionTeacherId:
          input.sectionTeacherId == null
            ? undefined
            : requireGraphqlId(input.sectionTeacherId, "sectionTeacherId"),
        targetType: input.targetType,
        teacherId: input.teacherId,
        userId: principal.userId,
        visibility: input.visibility ?? "public",
      });
      if (!result.ok) handleCommentFailure(result);
      return { id: result.comment.id };
    },
    async updateComment(
      _parent: unknown,
      args: { id: string; input: UpdateCommentInput },
      context: GraphqlContext,
    ) {
      const principal = await requireGraphqlMutation(context, "comment");
      rejectExplicitNullFields(args.input, [
        "visibility",
        "isAnonymous",
        "attachmentIds",
      ]);
      const hasAttachmentUpdate = Object.hasOwn(args.input, "attachmentIds");
      const attachmentIds =
        normalizeIdList(args.input.attachmentIds, "attachmentIds") ?? [];
      const result = await updateOwnComment({
        attachmentIds,
        auditMetadata: graphqlCommentAuditMetadata(context.request),
        body: normalizeCommentBody(args.input.body),
        hasAttachmentUpdate,
        id: requireMutationId(args.id, "id"),
        isAnonymous: args.input.isAnonymous ?? undefined,
        userId: principal.userId,
        visibility: args.input.visibility ?? undefined,
      });
      if (!result.ok) handleCommentFailure(result);
      return { id: result.comment.id };
    },
    async deleteComment(
      _parent: unknown,
      args: { id: string },
      context: GraphqlContext,
    ) {
      const principal = await requireGraphqlMutation(context, "comment");
      const id = requireMutationId(args.id, "id");
      const result = await deleteOwnComment({
        auditMetadata: graphqlCommentAuditMetadata(context.request),
        commentId: id,
        userId: principal.userId,
      });
      if (!result.ok) handleCommentFailure(result);
      return { id, success: true };
    },
    async addCommentReaction(
      _parent: unknown,
      args: { commentId: string; type: CommentReactionType },
      context: GraphqlContext,
    ) {
      const principal = await requireGraphqlMutation(context, "comment");
      const commentId = requireMutationId(args.commentId, "commentId");
      const result = await createCommentReaction({
        auditMetadata: graphqlCommentAuditMetadata(context.request),
        commentId,
        type: args.type,
        userId: principal.userId,
      });
      if (!result.ok) handleCommentFailure(result);
      return {
        commentId,
        type: args.type,
        active: true,
        changed: result.changed,
      };
    },
    async removeCommentReaction(
      _parent: unknown,
      args: { commentId: string; type: CommentReactionType },
      context: GraphqlContext,
    ) {
      const principal = await requireGraphqlMutation(context, "comment");
      const commentId = requireMutationId(args.commentId, "commentId");
      const result = await deleteCommentReaction({
        auditMetadata: graphqlCommentAuditMetadata(context.request),
        commentId,
        type: args.type,
        userId: principal.userId,
      });
      if (!result.ok) handleCommentFailure(result);
      return {
        commentId,
        type: args.type,
        active: false,
        changed: result.changed,
      };
    },
  },
};
