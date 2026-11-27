<script lang="ts">
import * as Alert from "#lib/components/ui/alert/index.js";

export let bulkImportError: string;
export let bulkImportMessage: string;
export let subscriptionActionError: string;
</script>

{#if bulkImportMessage}
  <Alert.Message>{bulkImportMessage}</Alert.Message>
{/if}
{#if bulkImportError}
  <Alert.Message variant="destructive">{bulkImportError}</Alert.Message>
{/if}
{#if subscriptionActionError}
  <Alert.Message variant="destructive">{subscriptionActionError}</Alert.Message>
{/if}
