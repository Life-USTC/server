<script lang="ts">
import { cn } from "$lib/utils.js";

let className = "";

export { className as class };
export let message: string;
</script>

<p class={cn("text-sm text-muted-foreground", className)}>{message}</p>
