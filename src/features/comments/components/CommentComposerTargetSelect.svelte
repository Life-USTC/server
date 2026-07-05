<script lang="ts">
import type { ViewerContext } from "@/lib/auth/viewer-context";
import * as Field from "$lib/components/ui/field/index.js";
import * as NativeSelect from "$lib/components/ui/native-select/index.js";
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
  <Field.Field class="max-w-sm">
    <Field.Label for="comment-composer-target">
      {commentCopy.commentTargetPlaceholder}
    </Field.Label>
    <NativeSelect.Root
      aria-label={commentCopy.commentTargetPlaceholder}
      bind:value={postTargetKey}
      class="w-full"
      disabled={!viewer.isAuthenticated || viewer.isSuspended}
      id="comment-composer-target"
    >
      {#each postTargetOptions as option}
        <NativeSelect.Option value={option.value}>
          {option.label}
        </NativeSelect.Option>
      {/each}
    </NativeSelect.Root>
    <Field.Description>
      {commentCopy.commentTargetCurrent.replace(
        "{label}",
        postTargetOptions.find((option) => option.value === postTargetKey)
          ?.label ?? "",
      )}
    </Field.Description>
  </Field.Field>
{/if}
