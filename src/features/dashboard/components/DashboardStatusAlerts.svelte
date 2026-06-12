<script lang="ts">
import { Alert } from "$lib/components/ui/alert/index.js";

export let actionError: string | null | undefined = "";
export let calendarCopyError: string | null | undefined = "";
export let calendarCopyMessage: string | null | undefined = "";
</script>

{#if actionError}
  <Alert variant="destructive">
    <span>{actionError}</span>
  </Alert>
{/if}
{#if calendarCopyMessage}
  <Alert variant="info">
    <span>{calendarCopyMessage}</span>
  </Alert>
{/if}
{#if calendarCopyError}
  <Alert variant="destructive">
    <span>{calendarCopyError}</span>
  </Alert>
{/if}
