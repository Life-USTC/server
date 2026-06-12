<script lang="ts">
import { Alert } from "$lib/components/ui/alert/index.js";

export let copyMessage = "";
export let copyMessageVariant: "destructive" | "info" = "info";
export let form:
  | { createdClientId?: string | null; message?: string }
  | null
  | undefined;
</script>

{#if copyMessage}
  <Alert variant={copyMessageVariant}>{copyMessage}</Alert>
{/if}

{#if form?.message && !form?.createdClientId}
  <Alert variant="info">{form.message}</Alert>
{/if}
