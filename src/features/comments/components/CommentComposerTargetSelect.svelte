<script lang="ts">
import type { ViewerContext } from "@/lib/auth/viewer-context";
import * as Field from "$lib/components/ui/field/index.js";
import * as Select from "$lib/components/ui/select/index.js";
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
    <Select.Root
      bind:value={postTargetKey}
      disabled={!viewer.isAuthenticated || viewer.isSuspended}
      type="single"
    >
      <Select.Trigger
        id="comment-composer-target"
        aria-label={commentCopy.commentTargetPlaceholder}
        class="w-full"
      >
        {postTargetOptions.find((option) => option.value === postTargetKey)
          ?.label ?? postTargetOptions[0]?.label ?? ""}
      </Select.Trigger>
      <Select.Content>
        <Select.Group>
          {#each postTargetOptions as option}
            <Select.Item label={option.label} value={option.value}>
              {option.label}
            </Select.Item>
          {/each}
        </Select.Group>
      </Select.Content>
    </Select.Root>
    <Field.Description>
      {commentCopy.commentTargetCurrent.replace(
        "{label}",
        postTargetOptions.find((option) => option.value === postTargetKey)
          ?.label ?? "",
      )}
    </Field.Description>
  </Field.Field>
{/if}
