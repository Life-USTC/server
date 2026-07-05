<script lang="ts">
import type { ViewerContext } from "@/lib/auth/viewer-context";
import * as Card from "$lib/components/ui/card/index.js";
import { Checkbox } from "$lib/components/ui/checkbox/index.js";
import * as Field from "$lib/components/ui/field/index.js";
import * as Select from "$lib/components/ui/select/index.js";
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

<Card.Header>
  <Card.Title>{commentCopy.postAction}</Card.Title>
  <Card.Description>{commentCopy.subtitle}</Card.Description>
  <Card.Action>
    <Field.Group class="flex-row flex-wrap items-center gap-3 text-sm">
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
        <Field.Label for="comment-composer-anonymous" class="font-normal">
          {commentCopy.visibilityAnonymous}
        </Field.Label>
      </Field.Field>
      <Field.Field data-disabled={controlsDisabledAttr} class="w-auto">
        <Field.Label for="comment-composer-visibility" class="sr-only">
          {commentCopy.visibilityLabel}
        </Field.Label>
        <Select.Root
          bind:value={visibility}
          disabled={controlsDisabled}
          type="single"
        >
          <Select.Trigger
            id="comment-composer-visibility"
            aria-label={commentCopy.visibilityLabel}
            class="min-w-32"
          >
            {visibilityOptions.find((option) => option.value === visibility)
              ?.label ?? visibilityOptions[0]?.label ?? ""}
          </Select.Trigger>
          <Select.Content>
            <Select.Group>
              {#each visibilityOptions as option}
                <Select.Item label={option.label} value={option.value}>
                  {option.label}
                </Select.Item>
              {/each}
            </Select.Group>
          </Select.Content>
        </Select.Root>
      </Field.Field>
    </Field.Group>
  </Card.Action>
</Card.Header>
