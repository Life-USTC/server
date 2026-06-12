<script lang="ts">
import { Dialog as DialogPrimitive } from "bits-ui";

let className = "";

export { className as class };
</script>

<DialogPrimitive.Description class={`text-base-content/70 text-sm ${className}`} data-slot="dialog-description" {...$$restProps}>
  <slot />
</DialogPrimitive.Description>
