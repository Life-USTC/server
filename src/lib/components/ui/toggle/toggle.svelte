<script lang="ts">
import { cn } from "$lib/utils.js";
import { type ToggleProps, toggleVariants } from "./toggle-variants.js";

let {
  ref = $bindable(null),
  class: className,
  pressed = false,
  variant = "default",
  size = "default",
  children,
  ...restProps
}: ToggleProps = $props();

export { className as class };
</script>

<button
  bind:this={ref}
  aria-pressed={pressed}
  class={cn(toggleVariants({ variant, size }), className)}
  data-slot="toggle"
  data-state={pressed ? "on" : "off"}
  type="button"
  {...restProps}
>
  {@render children?.()}
</button>
