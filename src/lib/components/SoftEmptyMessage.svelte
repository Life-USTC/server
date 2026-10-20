<script lang="ts">
import { cn } from "#lib/utils.js";

let {
  class: className = "",
  message,
}: {
  class?: string;
  message: string;
} = $props();
</script>

<p
  class={cn("text-sm text-muted-foreground", className)}
  data-empty-variant="quiet"
>
  {message}
</p>
