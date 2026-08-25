<script lang="ts">
import {
  Button,
  type ButtonSize,
  type ButtonVariant,
} from "$lib/components/ui/button/index.js";
import * as Tooltip from "$lib/components/ui/tooltip/index.js";

export let label: string;
export let disabled = false;
export let href: string | undefined = undefined;
export let className = "";
export let size: ButtonSize = "icon-sm";
export let type: "button" | "submit" | "reset" | undefined = undefined;
export let variant: ButtonVariant = "outline";
export let onclick: ((event: MouseEvent) => void) | undefined = undefined;
</script>

<Tooltip.Root>
  <Tooltip.Trigger>
    {#snippet child({ props })}
      <Button
        {...props}
        aria-label={label}
        class={className}
        {disabled}
        {href}
        {size}
        type={href ? undefined : (type ?? "button")}
        {variant}
        {onclick}
      >
        <slot />
      </Button>
    {/snippet}
  </Tooltip.Trigger>
  <Tooltip.Content>{label}</Tooltip.Content>
</Tooltip.Root>
