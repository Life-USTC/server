<script lang="ts">
import * as Alert from "$lib/components/ui/alert/index.js";

export let form:
  | { message?: string; variant?: "destructive" | "default" }
  | null
  | undefined;
</script>

{#if form?.message}
  <Alert.Root variant={form.variant ?? "default"}>
    <Alert.Description>{form.message}</Alert.Description>
  </Alert.Root>
{/if}
