<script lang="ts">
import { Alert } from "$lib/components/ui/alert/index.js";

export let form:
  | { message?: string; variant?: "destructive" | "info" }
  | null
  | undefined;
</script>

{#if form?.message}
  <Alert variant={form.variant ?? "info"}>{form.message}</Alert>
{/if}
