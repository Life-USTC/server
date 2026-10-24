<script lang="ts">
import CollectionEmpty from "#lib/components/CollectionEmpty.svelte";
import ResponsiveCollection from "#lib/components/ResponsiveCollection.svelte";
import AdminModerationCommentsMobile from "./AdminModerationCommentsMobile.svelte";
import AdminModerationCommentsTable from "./AdminModerationCommentsTable.svelte";
import type {
  AdminModerationComment,
  AdminModerationCommentFormatter,
  AdminModerationCommentStatusFormatter,
  AdminModerationCommentsCopy,
} from "./admin-moderation-comment-types";
import type { AdminModerationFilterControls } from "./admin-moderation-page-types";

export let filterControls: AdminModerationFilterControls;
export let comments: AdminModerationComment[];
export let copy: AdminModerationCommentsCopy;
export let commentAuthorLabel: AdminModerationCommentFormatter;
export let formatDate: (value: string | Date) => string;
export let onManage: (comment: AdminModerationComment) => void;
export let statusLabel: AdminModerationCommentStatusFormatter;
export let targetHref: AdminModerationCommentFormatter;
export let targetLabel: AdminModerationCommentFormatter;
</script>

<section class="grid grid-cols-[minmax(0,1fr)] gap-3">
    <ResponsiveCollection>
      {#snippet mobile()}
        <div class="mb-3 flex flex-wrap items-center gap-2" data-slot="collection-header">
          {@render filterControls("search", "mobile")}
          {@render filterControls("status", "mobile")}
        </div>
        {#if comments.length === 0}<CollectionEmpty variant="compact" description={copy.noComments} />{:else}
        <AdminModerationCommentsMobile
          {commentAuthorLabel}
          {comments}
          {formatDate}
          manageLabel={copy.manageComment}
          {onManage}
          {statusLabel}
          {targetLabel}
        />
        {/if}
      {/snippet}
      {#snippet desktop()}
        <AdminModerationCommentsTable
          {filterControls}
          {commentAuthorLabel}
          {comments}
          {copy}
          {formatDate}
          {onManage}
          {statusLabel}
          {targetHref}
          {targetLabel}
        />
      {/snippet}
    </ResponsiveCollection>
</section>
