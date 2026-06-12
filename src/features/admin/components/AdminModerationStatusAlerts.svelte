<script lang="ts">
import { formAlertVariant } from "@/features/admin/lib/moderation-display";
import { Alert } from "$lib/components/ui/alert/index.js";

export let form: { kind?: string; message?: string } | null | undefined;
export let refreshError = "";
</script>

{#if refreshError}
  <Alert variant="destructive">{refreshError}</Alert>
{/if}

{#if form?.message}
  <Alert variant={formAlertVariant(form.kind)}>{form.message}</Alert>
{/if}
