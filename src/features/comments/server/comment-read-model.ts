/** Comment read-model barrel — re-exports split domain modules. */

export { loadFocusedCommentThread } from "./comment-focused-read";
export {
  observeCommentViewerContext,
  withCommentAuthorProviders,
  withCommentReadMetadata,
} from "./comment-read-metadata";
export {
  type CommentTargetLookupRecord,
  commentTargetLookupSelect,
  commentThreadInclude,
  findComment,
  loadCommentReplyWindow,
} from "./comment-read-shared";
export { loadCommentReplies } from "./comment-replies-read";
export { loadCommentThread } from "./comment-thread-read";
