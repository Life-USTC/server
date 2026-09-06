import type { PersistedGraphqlOperationDefinition } from "../operation-types";
import { mutation, query } from "./helpers";

export const communityGraphqlOperationDefinitions = [
  query({
    id: "community.user.get.v1",
    title: "Get community user",
    description: "Returns one public community identity by username or id.",
    document: /* GraphQL */ `
      query CommunityUser($identifier: String!) {
        community {
          user(identifier: $identifier) {
            id
            username
            name
            image
            createdAt
          }
        }
      }
    `,
    scopes: [],
  }),
  mutation({
    id: "community.section_homework.create.v1",
    title: "Create homework",
    description: "Creates collaborative homework on a section.",
    document: /* GraphQL */ `
      mutation HomeworkCreate($input: CreateHomeworkInput!) {
        homeworkCreate(input: $input) {
          id
          homework {
            id
            title
            isMajor
            requiresTeam
            publishedAt
            submissionStartAt
            submissionDueAt
            createdAt
            updatedAt
            commentCount
            section {
              id
              jwId
              code
            }
          }
        }
      }
    `,
    scopes: ["community.section-homework:write"],
    destructive: false,
    openWorld: true,
  }),
  mutation({
    id: "community.section_homework.update.v1",
    title: "Update homework",
    description: "Updates collaborative homework on a section.",
    document: /* GraphQL */ `
      mutation HomeworkUpdate($id: ID!, $input: UpdateHomeworkInput!) {
        homeworkUpdate(id: $id, input: $input) {
          id
          homework {
            id
            title
            isMajor
            requiresTeam
            publishedAt
            submissionStartAt
            submissionDueAt
            createdAt
            updatedAt
            commentCount
            section {
              id
              jwId
              code
            }
          }
        }
      }
    `,
    scopes: ["community.section-homework:write"],
    destructive: true,
    openWorld: true,
  }),
  mutation({
    id: "community.section_homework.delete.v1",
    title: "Delete homework",
    description: "Soft-deletes collaborative homework on a section.",
    document: /* GraphQL */ `
      mutation HomeworkDelete($id: ID!) {
        homeworkDelete(id: $id) {
          id
          success
          alreadyDeleted
        }
      }
    `,
    scopes: ["community.section-homework:write"],
    destructive: true,
    openWorld: true,
  }),
  mutation({
    id: "community.description.set.v1",
    title: "Upsert description",
    description: "Creates or updates collaborative object description text.",
    document: /* GraphQL */ `
      mutation DescriptionUpsert($input: UpsertDescriptionInput!) {
        descriptionSet(input: $input) {
          id
          updated
        }
      }
    `,
    scopes: ["community.description:write"],
    destructive: true,
    openWorld: true,
  }),
  mutation({
    id: "community.comment.create.v1",
    title: "Create comment",
    description: "Creates a collaborative comment or reply.",
    document: /* GraphQL */ `
      mutation CommentCreate($input: CreateCommentInput!) {
        commentCreate(input: $input) {
          id
        }
      }
    `,
    scopes: ["community.comment:write"],
    destructive: false,
    openWorld: true,
  }),
  mutation({
    id: "community.comment.update.v1",
    title: "Update comment",
    description: "Updates a comment owned by the authenticated workspace.",
    document: /* GraphQL */ `
      mutation CommentUpdate($id: ID!, $input: UpdateCommentInput!) {
        commentUpdate(id: $id, input: $input) {
          id
        }
      }
    `,
    scopes: ["community.comment:write"],
    destructive: true,
    openWorld: true,
  }),
  mutation({
    id: "community.comment.delete.v1",
    title: "Delete comment",
    description: "Deletes a comment owned by the authenticated workspace.",
    document: /* GraphQL */ `
      mutation CommentDelete($id: ID!) {
        commentDelete(id: $id) {
          id
          success
        }
      }
    `,
    scopes: ["community.comment:write"],
    destructive: true,
    openWorld: true,
  }),
  mutation({
    id: "community.comments.delete.v1",
    title: "Delete comments in batch",
    description:
      "Deletes up to 50 workspace-owned comments with stable per-item results.",
    document: /* GraphQL */ `
      mutation CommentDeleteBatch($ids: [ID!]!) {
        commentsDelete(ids: $ids) {
          results {
            success
            id
            error {
              code
              message
            }
          }
        }
      }
    `,
    scopes: ["community.comment:write"],
    destructive: true,
    openWorld: true,
  }),
  mutation({
    id: "community.comment.reaction.add.v1",
    title: "Add comment reaction",
    description: "Adds the workspace's reaction to a visible comment.",
    document: /* GraphQL */ `
      mutation CommentAddReaction(
        $commentId: ID!
        $type: CommentReactionType!
      ) {
        commentReactionAdd(commentId: $commentId, type: $type) {
          commentId
          type
          active
          changed
        }
      }
    `,
    scopes: ["community.comment:write"],
    destructive: false,
    openWorld: true,
  }),
  mutation({
    id: "community.comment.reaction.remove.v1",
    title: "Remove comment reaction",
    description: "Removes the workspace's reaction from a visible comment.",
    document: /* GraphQL */ `
      mutation CommentRemoveReaction(
        $commentId: ID!
        $type: CommentReactionType!
      ) {
        commentReactionRemove(commentId: $commentId, type: $type) {
          commentId
          type
          active
          changed
        }
      }
    `,
    scopes: ["community.comment:write"],
    destructive: true,
    openWorld: true,
  }),
] as const satisfies readonly PersistedGraphqlOperationDefinition[];
