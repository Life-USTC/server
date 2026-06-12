<script lang="ts">
import { Alert } from "$lib/components/ui/alert/index.js";

export let centered = false;
export let description: string;
export let title: string;
</script>

<Alert>
  <div class={`grid gap-1 ${centered ? "text-center" : ""}`}>
    <p class="font-semibold">{title}</p>
    <p class="text-base-content/60">{description}</p>
  </div>
</Alert>
