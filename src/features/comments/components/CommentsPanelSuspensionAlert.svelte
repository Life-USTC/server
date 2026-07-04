<script lang="ts">
import type { ViewerContext } from "@/lib/auth/viewer-context";
import * as Alert from "$lib/components/ui/alert/index.js";
import type { CommentsCopy } from "./comment-component-types";

export let commentCopy: CommentsCopy;
export let formatTime: (value: Date | string | null | undefined) => string;
export let viewer: ViewerContext;
</script>

<Alert.Root>
  <Alert.Title role="heading" aria-level={3}>{commentCopy.suspendedTitle}</Alert.Title>
  <Alert.Description>
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
  </Alert.Description>
</Alert.Root>
