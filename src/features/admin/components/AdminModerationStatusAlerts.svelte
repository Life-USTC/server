<script lang="ts">
import * as Alert from "#lib/components/ui/alert/index.js";
import { formAlertVariant } from "@/features/admin/lib/moderation-display";

export let form: { kind?: string; message?: string } | null | undefined;
export let refreshError = "";
</script>

{#if refreshError}
  <Alert.Message variant="destructive">{refreshError}</Alert.Message>
{/if}

{#if form?.message && form.kind !== "success"}
  <Alert.Message variant={formAlertVariant(form.kind)}>{form.message}</Alert.Message>
{/if}
