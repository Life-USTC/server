<script lang="ts">
import { Checkbox } from "$lib/components/ui/checkbox/index.js";
import * as Field from "$lib/components/ui/field/index.js";
import * as NativeSelect from "$lib/components/ui/native-select/index.js";
import type {
  CommentSelectOption,
  CommentsCopy,
} from "./comment-component-types";

export let anonymousId: string;
export let visibilityId: string;
export let commentCopy: Pick<
  CommentsCopy,
  "visibilityAnonymous" | "visibilityLabel"
>;
export let isAnonymous: boolean;
export let visibility: string;
export let visibilityOptions: CommentSelectOption[];
export let disabled = false;

$: disabledAttr = disabled ? "true" : undefined;
</script>

<Field.Field data-disabled={disabledAttr} orientation="horizontal" class="w-fit">
  <Checkbox id={anonymousId} bind:checked={isAnonymous} {disabled} />
  <Field.Label for={anonymousId}>
    {commentCopy.visibilityAnonymous}
  </Field.Label>
</Field.Field>
<Field.Field data-disabled={disabledAttr} class="w-auto">
  <Field.Label for={visibilityId} class="sr-only">
    {commentCopy.visibilityLabel}
  </Field.Label>
  <NativeSelect.Root
    aria-label={commentCopy.visibilityLabel}
    bind:value={visibility}
    class="min-w-32"
    {disabled}
    id={visibilityId}
  >
    {#each visibilityOptions as option}
      <NativeSelect.Option value={option.value}>
        {option.label}
      </NativeSelect.Option>
    {/each}
  </NativeSelect.Root>
</Field.Field>
