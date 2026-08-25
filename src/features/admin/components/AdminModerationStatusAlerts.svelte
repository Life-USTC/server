<script lang="ts">
import { formAlertVariant } from "@/features/admin/lib/moderation-display";
import * as Alert from "$lib/components/ui/alert/index.js";

export let form: { kind?: string; message?: string } | null | undefined;
export let refreshError = "";
</script>

{#if refreshError}
  <Alert.Root variant="destructive">
    <Alert.Description>{refreshError}</Alert.Description>
  </Alert.Root>
{/if}

{#if form?.message}
  <Alert.Root variant={formAlertVariant(form.kind)}>
    <Alert.Description>{form.message}</Alert.Description>
  </Alert.Root>
{/if}
