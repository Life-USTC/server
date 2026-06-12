<script lang="ts">
import { Alert } from "$lib/components/ui/alert/index.js";

export let message: string;
export let title: string;
</script>

<Alert>
  <div class="grid gap-1">
    <h2 class="font-semibold text-error">{title}</h2>
    <p class="text-base-content/70">{message}</p>
  </div>
</Alert>
