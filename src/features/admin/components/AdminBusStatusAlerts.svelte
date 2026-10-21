<script lang="ts">
import * as Alert from "#lib/components/ui/alert/index.js";

interface Props {
  form:
    | { message?: string; variant?: "destructive" | "default" }
    | null
    | undefined;
}

let { form }: Props = $props();
</script>

{#if form?.message && form.variant === "destructive"}
  <Alert.Root variant={form.variant ?? "default"}>
    <Alert.Description>{form.message}</Alert.Description>
  </Alert.Root>
{/if}
