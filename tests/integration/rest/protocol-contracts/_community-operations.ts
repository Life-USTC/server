import type { Operation } from "./_transport";

export function commentCreate(
  sectionJwId: number,
  body: string,
  parentId?: string,
  attachmentIds?: string[],
): Operation {
  const input = {
    targetType: "section",
    sectionJwId,
    body,
    ...(parentId ? { parentId } : {}),
    ...(attachmentIds ? { attachmentIds } : {}),
  };
  return {
    rest: { path: "/api/community/comments", method: "POST", body: input },
    graphql: {
      field: "commentCreate",
      query:
        "mutation($input: CreateCommentInput!) { commentCreate(input:$input) { id } }",
      variables: { input: { ...input, targetType: "SECTION" } },
    },
    mcp: { name: "community_comment_create", arguments: input },
  };
}
export function commentUpdate(
  id: string,
  body: string,
  attachmentIds?: string[],
): Operation {
  const input = { body, ...(attachmentIds ? { attachmentIds } : {}) };
  return {
    rest: {
      path: `/api/community/comments/${id}`,
      method: "PATCH",
      body: input,
    },
    graphql: {
      field: "commentUpdate",
      query:
        "mutation($id: ID!, $input: UpdateCommentInput!) { commentUpdate(id:$id,input:$input) { id } }",
      variables: { id, input },
    },
    mcp: {
      name: "community_comment_update",
      arguments: { commentId: id, ...input },
    },
  };
}
export function reaction(id: string, add: boolean): Operation {
  const field = add ? "commentReactionAdd" : "commentReactionRemove";
  return {
    rest: {
      path: `/api/community/comments/${id}/reactions${add ? "" : "?type=heart"}`,
      method: add ? "POST" : "DELETE",
      ...(add ? { body: { type: "heart" } } : {}),
    },
    graphql: {
      field,
      query: `mutation($id: ID!) { ${field}(commentId:$id,type:HEART) { active changed } }`,
      variables: { id },
    },
    mcp: {
      name: `community_comment_reaction_${add ? "add" : "remove"}`,
      arguments: { commentId: id, type: "heart" },
    },
  };
}
export function descriptionSet(
  sectionJwId: number,
  content: string,
): Operation {
  const input = { targetType: "section", sectionJwId, content };
  return {
    rest: { path: "/api/community/descriptions", method: "POST", body: input },
    graphql: {
      field: "descriptionSet",
      query:
        "mutation($input: UpsertDescriptionInput!) { descriptionSet(input:$input) { id updated } }",
      variables: { input: { ...input, targetType: "SECTION" } },
    },
    mcp: { name: "community_description_set", arguments: input },
  };
}
export function homeworkCreate(sectionJwId: number, title: string): Operation {
  const input = { sectionJwId, title };
  return {
    rest: {
      path: "/api/community/section-homeworks",
      method: "POST",
      body: input,
    },
    graphql: {
      field: "homeworkCreate",
      query:
        "mutation($input: CreateHomeworkInput!) { homeworkCreate(input:$input) { id homework { id title createdAt updatedAt publishedAt submissionStartAt submissionDueAt isMajor requiresTeam completionRequired completed completedAt } } }",
      variables: { input },
    },
    mcp: { name: "community_section_homework_create", arguments: input },
  };
}
export function homeworkUpdate(id: string, title: string): Operation {
  return {
    rest: {
      path: `/api/community/section-homeworks/${id}`,
      method: "PATCH",
      body: { title },
    },
    graphql: {
      field: "homeworkUpdate",
      query:
        "mutation($id: ID!, $input: UpdateHomeworkInput!) { homeworkUpdate(id:$id,input:$input) { id homework { id title createdAt updatedAt publishedAt submissionStartAt submissionDueAt isMajor requiresTeam completionRequired completed completedAt } } }",
      variables: { id, input: { title } },
    },
    mcp: {
      name: "community_section_homework_update",
      arguments: { homeworkId: id, title },
    },
  };
}
