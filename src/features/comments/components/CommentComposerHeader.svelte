<script lang="ts">
import type { ViewerContext } from "@/lib/auth/viewer-context";
import * as Card from "$lib/components/ui/card/index.js";
import { Checkbox } from "$lib/components/ui/checkbox/index.js";
import * as Field from "$lib/components/ui/field/index.js";
import * as NativeSelect from "$lib/components/ui/native-select/index.js";
import type {
  CommentSelectOption,
  CommentsCopy,
} from "./comment-component-types";

export let commentCopy: CommentsCopy;
export let isAnonymous: boolean;
export let viewer: ViewerContext;
export let visibility: string;
export let visibilityOptions: CommentSelectOption[];

$: controlsDisabled = !viewer.isAuthenticated || viewer.isSuspended;
$: controlsDisabledAttr = controlsDisabled ? "true" : undefined;
</script>

<Card.Header class="min-[420px]:grid-cols-[1fr_auto]">
  <Card.Title>{commentCopy.postAction}</Card.Title>
  <Card.Description>{commentCopy.subtitle}</Card.Description>
  <div
    class="mt-2 w-full min-[420px]:col-start-2 min-[420px]:row-span-2 min-[420px]:row-start-1 min-[420px]:mt-0 min-[420px]:w-60 min-[420px]:justify-self-end"
  >
    <Field.Group class="w-full flex-row flex-wrap items-center gap-3">
      <Field.Field
        data-disabled={controlsDisabledAttr}
        orientation="horizontal"
        class="w-fit"
      >
        <Checkbox
          id="comment-composer-anonymous"
          bind:checked={isAnonymous}
          disabled={controlsDisabled}
        />
        <Field.Label for="comment-composer-anonymous">
          {commentCopy.visibilityAnonymous}
        </Field.Label>
      </Field.Field>
      <Field.Field data-disabled={controlsDisabledAttr} class="w-auto">
        <Field.Label for="comment-composer-visibility" class="sr-only">
          {commentCopy.visibilityLabel}
        </Field.Label>
        <NativeSelect.Root
          aria-label={commentCopy.visibilityLabel}
          bind:value={visibility}
          class="min-w-32"
          disabled={controlsDisabled}
          id="comment-composer-visibility"
        >
          {#each visibilityOptions as option}
            <NativeSelect.Option value={option.value}>
              {option.label}
            </NativeSelect.Option>
          {/each}
        </NativeSelect.Root>
      </Field.Field>
    </Field.Group>
  </div>
</Card.Header>
