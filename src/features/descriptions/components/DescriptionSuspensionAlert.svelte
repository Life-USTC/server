<script lang="ts">
import { formatDescriptionCopy } from "@/features/descriptions/lib/description-card-actions";
import { Alert } from "$lib/components/ui/alert/index.js";
import type {
  DescriptionCopy,
  DescriptionViewer,
} from "./description-component-types";

export let copy: DescriptionCopy;
export let formatDate: (value: string | null | undefined) => string;
export let viewer: DescriptionViewer;
</script>

<Alert variant="warning">
  <div class="grid gap-1">
    <p class="font-medium">{copy.suspendedTitle}</p>
    <p>{copy.suspendedMessage}</p>
    {#if viewer.suspensionReason}
      <p>{formatDescriptionCopy(copy.suspendedReason, { reason: viewer.suspensionReason })}</p>
    {/if}
    {#if viewer.suspensionExpiresAt}
      <p>{formatDescriptionCopy(copy.suspendedExpires, { date: formatDate(viewer.suspensionExpiresAt) })}</p>
    {:else}
      <p>{copy.suspendedPermanent}</p>
    {/if}
  </div>
</Alert>
