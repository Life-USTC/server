<script lang="ts">
import type { CommentNode } from "@/features/comments/server/comment-types";
import MarkdownPreview from "$lib/components/MarkdownPreview.svelte";
import CommentAttachmentCards from "./CommentAttachmentCards.svelte";
import CommentLinkCards from "./CommentLinkCards.svelte";
import CommentThreadEditForm from "./CommentThreadEditForm.svelte";
import type {
  CommentSelectOption,
  CommentsCopy,
  CommentUploadOption,
  UploadsCopy,
} from "./comment-component-types";

export let cancelEdit: () => void;
export let comment: CommentNode;
export let commentCopy: CommentsCopy;
export let editAttachmentIds: string[];
export let editAttachmentOptions: (
  comment: CommentNode,
) => CommentUploadOption[];
export let editDraft: string;
export let editingId: string | null;
export let editIsAnonymous: boolean;
export let editVisibility: string;
export let formatSize: (value: number | undefined) => string;
export let saveEdit: (comment: CommentNode) => void;
export let uploadCopy: UploadsCopy;
export let uploading: boolean;
export let uploadFile: (file: File, mode?: "edit" | "new" | "reply") => void;
export let visibilityOptions: CommentSelectOption[];
</script>

{#if editingId === comment.id}
  <CommentThreadEditForm
    {cancelEdit}
    {comment}
    {commentCopy}
    bind:editAttachmentIds
    {editAttachmentOptions}
    bind:editDraft
    bind:editIsAnonymous
    bind:editVisibility
    {saveEdit}
    {uploadCopy}
    {uploading}
    {uploadFile}
    {visibilityOptions}
  />
{:else if comment.status === "deleted"}
  <p class="text-base-content/60 text-sm">{commentCopy.deletedMessage}</p>
{:else}
  <MarkdownPreview class="break-words" content={comment.body} />
  <CommentLinkCards content={comment.body} copy={commentCopy} />
{/if}

{#if editingId !== comment.id}
  <CommentAttachmentCards
    attachments={comment.attachments}
    formatSize={formatSize}
    openLabel={commentCopy.openAttachment}
  />
{/if}
