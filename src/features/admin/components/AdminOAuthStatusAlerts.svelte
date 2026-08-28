<script lang="ts">
import * as Alert from "$lib/components/ui/alert/index.js";

export let copyMessage = "";
export let copyMessageVariant: "destructive" | "default" = "default";
export let form:
  | {
      createdClientId?: string | null;
      message?: string;
      variant?: "destructive" | "default";
    }
  | null
  | undefined;
</script>

{#if copyMessage && copyMessageVariant === "destructive"}
  <Alert.Root variant="destructive">
    <Alert.Description>{copyMessage}</Alert.Description>
  </Alert.Root>
{/if}

{#if form?.message && !form?.createdClientId && form.variant === "destructive"}
  <Alert.Root variant={form.variant ?? "default"}>
    <Alert.Description>{form.message}</Alert.Description>
  </Alert.Root>
{/if}
