<script lang="ts">
import * as Alert from "#lib/components/ui/alert/index.js";
import type { ViewerContext } from "@/lib/auth/viewer-context";
import { formatMessage } from "@/shared/lib/format-message";

let {
  copy,
  viewer,
  formatDate,
}: {
  copy: {
    suspendedTitle: string;
    suspendedMessage: string;
    suspendedReason: string;
    suspendedExpires: string;
    suspendedPermanent: string;
  };
  viewer: Pick<ViewerContext, "suspensionReason" | "suspensionExpiresAt">;
  formatDate: (value: string) => string;
} = $props();
</script>

<Alert.Root>
  <Alert.Title role="heading" aria-level={3}>{copy.suspendedTitle}</Alert.Title>
  <Alert.Description>
    <p>{copy.suspendedMessage}</p>
    {#if viewer.suspensionReason}
      <p>{formatMessage(copy.suspendedReason, { reason: viewer.suspensionReason })}</p>
    {/if}
    <p>{viewer.suspensionExpiresAt
      ? formatMessage(copy.suspendedExpires, { date: formatDate(viewer.suspensionExpiresAt) })
      : copy.suspendedPermanent}</p>
  </Alert.Description>
</Alert.Root>
