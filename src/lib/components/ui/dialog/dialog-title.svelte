<script lang="ts">
import { Dialog as DialogPrimitive } from "bits-ui";

let className = "";

export { className as class };
</script>

<DialogPrimitive.Title class={`font-semibold text-xl ${className}`} data-slot="dialog-title" {...$$restProps}>
  <slot />
</DialogPrimitive.Title>
