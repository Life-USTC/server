<script lang="ts">
import {
  type CommentNodeWithContext,
  type ReactionOption,
} from "@/features/comments/lib/comment-ui";
import type { CommentNode } from "@/features/comments/server/comment-types";
import type { ViewerContext } from "@/lib/auth/viewer-context";
import * as Card from "$lib/components/ui/card/index.js";
import CommentReactionControls from "./CommentReactionControls.svelte";
import CommentReplyEditor from "./CommentReplyEditor.svelte";
import CommentThreadBody from "./CommentThreadBody.svelte";
import CommentThreadHeader from "./CommentThreadHeader.svelte";
import type {
  CommentSelectOption,
  CommentsCopy,
  CommentThreadProps,
  CommentUploadOption,
  UploadsCopy,
} from "./comment-component-types";

export let actionMenuId: string | null;
export let authorInitials: (comment: CommentNode) => string;
export let authorName: (comment: CommentNode) => string;
export let cancelEdit: () => void;
export let cancelReply: () => void;
export let comment: CommentNodeWithContext;
export let commentCopy: CommentsCopy;
export let commentTarget: CommentThreadProps["commentTarget"];
export let copyCommentLink: (comment: CommentNode) => void;
export let depth = 0;
export let editAttachmentIds: string[];
export let editAttachmentOptions: (
  comment: CommentNode,
) => CommentUploadOption[];
export let editDraft: string;
export let editingId: string | null;
export let editIsAnonymous: boolean;
export let editVisibility: string;
export let formatSize: (value: number | undefined) => string;
export let formatTime: (value: string) => string;
export let highlightedId: string | null;
export let openDeleteDialog: (comment: CommentNode) => void;
export let pendingReactionKey: string | null;
export let react: (comment: CommentNode, type: string) => void;
export let reactionEntry: (
  comment: CommentNode,
  type: string,
) =>
  | {
      count: number;
      viewerHasReacted: boolean;
    }
  | undefined;
export let reactionKey: (commentId: string, type: string) => string;
export let reactionLabel: (type: string) => string;
export let reactionMenuId: string | null;
export let reactionName: (type: string) => string;
export let reactionOptions: ReactionOption[];
export let removeReplyAttachment: (uploadId: string) => void;
export let replyDraft: string;
export let replyingId: string | null;
export let replyIsAnonymous: boolean;
export let replyUploadedFiles: CommentUploadOption[];
export let replyVisibility: string;
export let saveEdit: (comment: CommentNode) => void;
export let startEdit: (comment: CommentNode) => void;
export let statusLabel: (status: string) => string;
export let submitting: boolean;
export let submitComment: CommentThreadProps["submitComment"];
export let toggleReply: (comment: CommentNode) => void;
export let uploadCopy: UploadsCopy;
export let uploading: boolean;
export let uploadFile: (file: File, mode?: "edit" | "new" | "reply") => void;
export let visibilityOptions: CommentSelectOption[];
export let viewer: ViewerContext;
</script>

<article
  class="grid gap-3"
  id={`comment-${comment.id}`}
  style={`margin-left: ${Math.min(depth, 3) * 1.25}rem`}
>
  <Card.Root
    class={`transition-colors duration-300 ${highlightedId === comment.id ? "ring-2 ring-primary/40" : ""}`}
  >
    <Card.Content class="grid gap-4 p-4 md:p-5">
      <CommentThreadHeader
        bind:actionMenuId
        {authorInitials}
        {authorName}
        {comment}
        {commentCopy}
        {copyCommentLink}
        {formatTime}
        {openDeleteDialog}
        {startEdit}
        {statusLabel}
        {toggleReply}
      />

      <CommentThreadBody
        {cancelEdit}
        {comment}
        {commentCopy}
        bind:editAttachmentIds
        {editAttachmentOptions}
        bind:editDraft
        {editingId}
        bind:editIsAnonymous
        bind:editVisibility
        {formatSize}
        {saveEdit}
        {uploadCopy}
        {uploading}
        {uploadFile}
        {visibilityOptions}
      />

      <CommentReactionControls
        {comment}
        {commentCopy}
        {pendingReactionKey}
        {react}
        {reactionEntry}
        {reactionKey}
        {reactionLabel}
        bind:reactionMenuId
        {reactionName}
        {reactionOptions}
      />

      {#if replyingId === comment.id}
        <CommentReplyEditor
          {cancelReply}
          {comment}
          {commentCopy}
          {commentTarget}
          {removeReplyAttachment}
          bind:replyDraft
          bind:replyIsAnonymous
          {replyUploadedFiles}
          bind:replyVisibility
          {submitting}
          {submitComment}
          {uploadCopy}
          {uploading}
          {uploadFile}
          {visibilityOptions}
          {viewer}
        />
      {/if}
    </Card.Content>
  </Card.Root>
</article>
