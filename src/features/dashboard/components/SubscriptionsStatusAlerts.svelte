<script lang="ts">
import * as Alert from "$lib/components/ui/alert/index.js";

export let bulkImportError: string;
export let bulkImportMessage: string;
export let subscriptionActionError: string;
export let subscriptionActionMessage: string;
</script>

{#if bulkImportMessage}
  <Alert.Root>
    <Alert.Description>{bulkImportMessage}</Alert.Description>
  </Alert.Root>
{/if}
{#if bulkImportError}
  <Alert.Root variant="destructive">
    <Alert.Description>{bulkImportError}</Alert.Description>
  </Alert.Root>
{/if}
{#if subscriptionActionMessage}
  <Alert.Root>
    <Alert.Description>{subscriptionActionMessage}</Alert.Description>
  </Alert.Root>
{/if}
{#if subscriptionActionError}
  <Alert.Root variant="destructive">
    <Alert.Description>{subscriptionActionError}</Alert.Description>
  </Alert.Root>
{/if}
