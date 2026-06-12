<script lang="ts">
import type { ViewerContext } from "@/lib/auth/viewer-context";
import * as Card from "$lib/components/ui/card/index.js";
import { Checkbox } from "$lib/components/ui/checkbox/index.js";
import { Select } from "$lib/components/ui/select/index.js";
import type {
  CommentSelectOption,
  CommentsCopy,
} from "./comment-component-types";

export let commentCopy: CommentsCopy;
export let isAnonymous: boolean;
export let viewer: ViewerContext;
export let visibility: string;
export let visibilityOptions: CommentSelectOption[];
</script>

<Card.Header>
  <div class="flex flex-wrap items-center justify-between gap-3">
    <div>
      <Card.Title>{commentCopy.postAction}</Card.Title>
      <Card.Description>{commentCopy.subtitle}</Card.Description>
    </div>
    <div class="flex flex-wrap items-center gap-3 text-sm">
      <label class="flex items-center gap-2">
        <Checkbox bind:checked={isAnonymous} disabled={!viewer.isAuthenticated || viewer.isSuspended} />
        <span>{commentCopy.visibilityAnonymous}</span>
      </label>
      <Select
        bind:value={visibility}
        disabled={!viewer.isAuthenticated || viewer.isSuspended}
        items={visibilityOptions}
      />
    </div>
  </div>
</Card.Header>
