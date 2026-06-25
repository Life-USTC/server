<script lang="ts">
import { DropdownMenu as MenuPrimitive } from "bits-ui";
import { cn } from "$lib/utils.js";
import {
  type ButtonSize,
  type ButtonVariant,
  buttonVariants,
} from "../button/button-variants";

let {
  ref = $bindable(null),
  class: className,
  size = "sm",
  variant = "ghost",
  ...restProps
}: MenuPrimitive.TriggerProps & {
  size?: ButtonSize;
  variant?: ButtonVariant;
} = $props();
</script>

<MenuPrimitive.Trigger
  bind:ref
  data-slot="menu-trigger"
  class={cn(buttonVariants({ size, variant }), className)}
  {...restProps}
/>
