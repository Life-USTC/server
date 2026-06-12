<script lang="ts">
import { Checkbox as CheckboxPrimitive } from "bits-ui";

export let checked = false;
export let disabled = false;
export let onchange:
  | ((event: { currentTarget: { checked: boolean } }) => void)
  | undefined = undefined;
let className = "";

export { className as class };

function handleCheckedChange(nextChecked: boolean) {
  checked = nextChecked;
  onchange?.({ currentTarget: { checked: nextChecked } });
}
</script>

<CheckboxPrimitive.Root
  {checked}
  class={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border border-base-300 bg-base-100 text-primary shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-content ${className}`}
  data-slot="checkbox"
  {disabled}
  onCheckedChange={handleCheckedChange}
  {...$$restProps}
>
  {#if checked}
    <span class="block h-2 w-2 rounded-[2px] bg-current" aria-hidden="true"></span>
  {/if}
</CheckboxPrimitive.Root>
