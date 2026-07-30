<script lang="ts">
import * as Alert from "$lib/components/ui/alert/index.js";

export let hint: string | null | undefined = undefined;
export let message: string;
</script>

<Alert.Root variant="destructive">
  <Alert.Description>{message}</Alert.Description>
  {#if hint}
    <Alert.Description class="text-destructive/90">{hint}</Alert.Description>
  {/if}
</Alert.Root>
