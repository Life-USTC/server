<script lang="ts">
import { formatDescriptionCopy } from "@/features/descriptions/lib/description-card-actions";
import * as Alert from "$lib/components/ui/alert/index.js";
import type {
  DescriptionCopy,
  DescriptionViewer,
} from "./description-component-types";

export let copy: DescriptionCopy;
export let formatDate: (value: string | null | undefined) => string;
export let viewer: DescriptionViewer;
</script>

<Alert.Root>
  <Alert.Title>{copy.suspendedTitle}</Alert.Title>
  <Alert.Description>
    <p>{copy.suspendedMessage}</p>
    {#if viewer.suspensionReason}
      <p>{formatDescriptionCopy(copy.suspendedReason, { reason: viewer.suspensionReason })}</p>
    {/if}
    {#if viewer.suspensionExpiresAt}
      <p>{formatDescriptionCopy(copy.suspendedExpires, { date: formatDate(viewer.suspensionExpiresAt) })}</p>
    {:else}
      <p>{copy.suspendedPermanent}</p>
    {/if}
  </Alert.Description>
</Alert.Root>
