<script lang="ts">
import { Alert } from "$lib/components/ui/alert/index.js";

export let bulkImportError: string;
export let bulkImportMessage: string;
export let subscriptionActionError: string;
export let subscriptionActionMessage: string;
</script>

{#if bulkImportMessage}
  <Alert>
    <span>{bulkImportMessage}</span>
  </Alert>
{/if}
{#if bulkImportError}
  <Alert variant="destructive">
    <span>{bulkImportError}</span>
  </Alert>
{/if}
{#if subscriptionActionMessage}
  <Alert>
    <span>{subscriptionActionMessage}</span>
  </Alert>
{/if}
{#if subscriptionActionError}
  <Alert variant="destructive">
    <span>{subscriptionActionError}</span>
  </Alert>
{/if}
