import {
  commentReactionTypeResolver,
  commentTargetTypeResolver,
  commentVisibilityResolver,
} from "../mutation-input";
import { busMutationResolvers } from "./bus";
import { commentMutationResolvers } from "./comments";
import {
  descriptionMutationResolvers,
  descriptionTargetTypeResolver,
} from "./descriptions";
import { homeworkMutationResolvers } from "./homeworks";
import { linkMutationResolvers } from "./links";
import { batchMutationErrorCodeResolver } from "./shared";
import {
  sectionSubscriptionBatchActionResolver,
  subscriptionMutationResolvers,
} from "./subscriptions";
import { todoMutationResolvers } from "./todos";
import { uploadMutationResolvers } from "./uploads";

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

  enum BatchMutationErrorCode {
    NOT_FOUND
    FORBIDDEN
    LOCKED
    DELETED
    SUSPENDED
  }

  enum SectionSubscriptionBatchAction {
    ADD
    REMOVE
    SET
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

  input TodoCompletionBatchItemInput {
    todoId: ID!
    completed: Boolean!
  }

  input HomeworkCompletionBatchItemInput {
    homeworkId: ID!
    completed: Boolean!
  }

  input UpdateSectionSubscriptionsInput {
    action: SectionSubscriptionBatchAction!
    codes: [String!]!
    semesterId: Int
  }

  input CreateHomeworkInput {
    sectionJwId: Int!
    title: String!
    description: String
    isMajor: Boolean! = false
    requiresTeam: Boolean! = false
    publishedAt: DateTime
    submissionStartAt: DateTime
    submissionDueAt: DateTime
  }

  input UpdateHomeworkInput {
    title: String
    description: String
    isMajor: Boolean
    requiresTeam: Boolean
    publishedAt: DateTime
    submissionStartAt: DateTime
    submissionDueAt: DateTime
  }

  input BusPreferenceInput {
    preferredOriginCampusId: Int
    preferredDestinationCampusId: Int
    showDepartedTrips: Boolean!
  }

  input WorkspaceLinkPinBatchItemInput {
    slug: String!
    pinned: Boolean!
  }

  input CreateUploadSessionInput {
    filename: String!
    contentType: String
    size: Float!
  }

  input CompleteUploadSessionInput {
    key: String!
    filename: String!
    contentType: String
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

  type BatchMutationError {
    code: BatchMutationErrorCode!
    message: String!
  }

  type TodoCompletionBatchResult {
    success: Boolean!
    todoId: ID!
    completed: Boolean!
    todo: Todo
    error: BatchMutationError
  }

  type TodoCompletionBatchPayload {
    results: [TodoCompletionBatchResult!]!
  }

  type TodoDeleteBatchResult {
    success: Boolean!
    id: ID!
    error: BatchMutationError
  }

  type TodoDeleteBatchPayload {
    results: [TodoDeleteBatchResult!]!
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

  type HomeworkCompletionBatchResult {
    success: Boolean!
    homeworkId: ID!
    completed: Boolean!
    completedAt: DateTime
    error: BatchMutationError
  }

  type HomeworkCompletionBatchPayload {
    results: [HomeworkCompletionBatchResult!]!
  }

  type HomeworkMutationPayload {
    id: ID!
    homework: Homework!
  }

  type HomeworkDeleteMutationPayload {
    id: ID!
    success: Boolean!
    alreadyDeleted: Boolean!
  }

  type SectionSubscriptionMutationPayload {
    sectionJwId: Int!
    subscribed: Boolean!
  }

  type SectionSubscriptionBatchPayload {
    action: SectionSubscriptionBatchAction!
    semesterId: Int
    matchedCodes: [String!]!
    unmatchedCodes: [String!]!
    addedCount: Int!
    removedCount: Int!
    unchangedCount: Int!
    total: Int!
  }

  type WorkspaceLinkPinMutationPayload {
    slug: String!
    pinned: Boolean!
    pinnedSlugs: [String!]!
    maxPinnedLinks: Int!
  }

  type WorkspaceLinkPinBatchMutationPayload {
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

  type CommentDeleteBatchResult {
    success: Boolean!
    id: ID!
    error: BatchMutationError
  }

  type CommentDeleteBatchPayload {
    results: [CommentDeleteBatchResult!]!
  }

  type UploadMutationRecord {
    id: ID!
    key: String!
    filename: String!
    size: Float!
    createdAt: DateTime!
  }

  type UploadSessionPayload {
    key: String!
    url: String!
    maxFileSizeBytes: Float!
    quotaBytes: Float!
    usedBytes: Float!
  }

  type UploadCompletionPayload {
    upload: UploadMutationRecord!
    usedBytes: Float!
    quotaBytes: Float!
  }

  type UploadMutationPayload {
    upload: UploadMutationRecord!
  }

  type UploadDeleteMutationPayload {
    id: ID!
    success: Boolean!
    deletedSize: Float!
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
    todoCreate(input: CreateTodoInput!): TodoMutationPayload!
    todoUpdate(id: ID!, input: UpdateTodoInput!): TodoMutationPayload!
    todoDelete(id: ID!): DeleteMutationPayload!
    todoCompletionsSet(
      items: [TodoCompletionBatchItemInput!]!
    ): TodoCompletionBatchPayload!
    todosDelete(ids: [ID!]!): TodoDeleteBatchPayload!
    homeworkCreate(input: CreateHomeworkInput!): HomeworkMutationPayload!
    homeworkUpdate(
      id: ID!
      input: UpdateHomeworkInput!
    ): HomeworkMutationPayload!
    homeworkDelete(id: ID!): HomeworkDeleteMutationPayload!
    homeworkCompletionSet(
      homeworkId: ID!
      completed: Boolean!
    ): HomeworkCompletionMutationPayload!
    homeworkCompletionsSet(
      items: [HomeworkCompletionBatchItemInput!]!
    ): HomeworkCompletionBatchPayload!
    subscriptionAdd(jwId: Int!): SectionSubscriptionMutationPayload!
    subscriptionRemove(jwId: Int!): SectionSubscriptionMutationPayload!
    subscriptionsImport(
      input: UpdateSectionSubscriptionsInput!
    ): SectionSubscriptionBatchPayload!
    linkPinSet(
      slug: String!
      pinned: Boolean!
    ): WorkspaceLinkPinMutationPayload!
    linkPinsSet(
      items: [WorkspaceLinkPinBatchItemInput!]!
    ): WorkspaceLinkPinBatchMutationPayload!
    busPreferencesSet(
      input: BusPreferenceInput!
    ): BusPreferenceMutationPayload!
    descriptionSet(
      input: UpsertDescriptionInput!
    ): DescriptionMutationPayload!
    commentCreate(input: CreateCommentInput!): CommentMutationPayload!
    commentUpdate(
      id: ID!
      input: UpdateCommentInput!
    ): CommentMutationPayload!
    commentDelete(id: ID!): DeleteMutationPayload!
    commentsDelete(ids: [ID!]!): CommentDeleteBatchPayload!
    commentReactionAdd(
      commentId: ID!
      type: CommentReactionType!
    ): CommentReactionMutationPayload!
    commentReactionRemove(
      commentId: ID!
      type: CommentReactionType!
    ): CommentReactionMutationPayload!
    uploadSessionCreate(
      input: CreateUploadSessionInput!
    ): UploadSessionPayload!
    uploadSessionComplete(
      input: CompleteUploadSessionInput!
    ): UploadCompletionPayload!
    uploadRename(id: ID!, filename: String!): UploadMutationPayload!
    uploadDelete(id: ID!): UploadDeleteMutationPayload!
  }
`;

export const graphqlMutationResolvers = {
  BatchMutationErrorCode: batchMutationErrorCodeResolver,
  CommentVisibility: commentVisibilityResolver,
  CommentReactionType: commentReactionTypeResolver,
  CommentTargetType: commentTargetTypeResolver,
  DescriptionTargetType: descriptionTargetTypeResolver,
  SectionSubscriptionBatchAction: sectionSubscriptionBatchActionResolver,
  Mutation: {
    ...todoMutationResolvers,
    ...homeworkMutationResolvers,
    ...subscriptionMutationResolvers,
    ...linkMutationResolvers,
    ...busMutationResolvers,
    ...descriptionMutationResolvers,
    ...commentMutationResolvers,
    ...uploadMutationResolvers,
  },
};
