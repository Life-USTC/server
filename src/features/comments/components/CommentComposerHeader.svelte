<script lang="ts">
import type { ViewerContext } from "@/lib/auth/viewer-context";
import * as Field from "$lib/components/ui/field/index.js";
import CommentAudienceFields from "./CommentAudienceFields.svelte";
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
</script>

<div class="grid auto-rows-min items-start gap-1 min-[420px]:grid-cols-[1fr_auto]">
  <h3 class="text-base font-medium leading-snug">{commentCopy.postAction}</h3>
  <p class="text-muted-foreground text-sm">{commentCopy.subtitle}</p>
  <div
    class="mt-2 w-full min-[420px]:col-start-2 min-[420px]:row-span-2 min-[420px]:row-start-1 min-[420px]:mt-0 min-[420px]:w-60 min-[420px]:justify-self-end"
  >
    <Field.Group class="w-full flex-row flex-wrap items-center gap-3">
      <CommentAudienceFields
        anonymousId="comment-composer-anonymous"
        visibilityId="comment-composer-visibility"
        {commentCopy}
        bind:isAnonymous
        bind:visibility
        {visibilityOptions}
        disabled={controlsDisabled}
      />
    </Field.Group>
  </div>
</div>
