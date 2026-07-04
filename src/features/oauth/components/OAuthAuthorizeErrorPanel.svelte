<script lang="ts">
import * as Alert from "$lib/components/ui/alert/index.js";

export let message: string;
export let title: string;
</script>

<Alert.Root variant="destructive">
  <Alert.Title role="heading" aria-level={2}>{title}</Alert.Title>
  <Alert.Description>{message}</Alert.Description>
</Alert.Root>
