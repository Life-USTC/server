<script lang="ts">
import type { ViewerContext } from "@/lib/auth/viewer-context";
import { Alert } from "$lib/components/ui/alert/index.js";
import type { CommentsCopy } from "./comment-component-types";

export let commentCopy: CommentsCopy;
export let formatTime: (value: Date | string | null | undefined) => string;
export let viewer: ViewerContext;
</script>

<Alert variant="warning">
  <div class="grid gap-1">
    <h3 class="font-semibold">{commentCopy.suspendedTitle}</h3>
    <p>{commentCopy.suspendedMessage}</p>
    {#if viewer.suspensionReason}
      <p>{commentCopy.suspendedReason.replace("{reason}", viewer.suspensionReason)}</p>
    {/if}
    <p>
      {viewer.suspensionExpiresAt
        ? commentCopy.suspendedExpires.replace(
            "{date}",
            formatTime(viewer.suspensionExpiresAt),
          )
        : commentCopy.suspendedPermanent}
    </p>
  </div>
</Alert>
