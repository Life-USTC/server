<script lang="ts">
import * as Alert from "$lib/components/ui/alert/index.js";

export let actionError: string | null | undefined = "";
export let calendarCopyError: string | null | undefined = "";
export let calendarCopyMessage: string | null | undefined = "";
</script>

{#if actionError}
  <Alert.Root variant="destructive">
    <Alert.Description>{actionError}</Alert.Description>
  </Alert.Root>
{/if}
{#if calendarCopyMessage}
  <Alert.Root>
    <Alert.Description>{calendarCopyMessage}</Alert.Description>
  </Alert.Root>
{/if}
{#if calendarCopyError}
  <Alert.Root variant="destructive">
    <Alert.Description>{calendarCopyError}</Alert.Description>
  </Alert.Root>
{/if}
