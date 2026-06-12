<script lang="ts">
import type { ViewerContext } from "@/lib/auth/viewer-context";
import { Select } from "$lib/components/ui/select/index.js";
import type {
  CommentSelectOption,
  CommentsCopy,
} from "./comment-component-types";

export let commentCopy: CommentsCopy;
export let postTargetKey: string;
export let postTargetOptions: CommentSelectOption[];
export let viewer: ViewerContext;
</script>

{#if postTargetOptions.length > 1}
  <label class="grid max-w-sm gap-2">
    <span class="font-medium text-sm">
      {commentCopy.commentTargetPlaceholder}
    </span>
    <Select
      bind:value={postTargetKey}
      disabled={!viewer.isAuthenticated || viewer.isSuspended}
      items={postTargetOptions}
    />
    <span class="text-base-content/60 text-xs">
      {commentCopy.commentTargetCurrent.replace(
        "{label}",
        postTargetOptions.find((option) => option.value === postTargetKey)
          ?.label ?? "",
      )}
    </span>
  </label>
{/if}
