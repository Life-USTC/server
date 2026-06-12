<script module lang="ts">
export type SelectItem = {
  disabled?: boolean;
  label: string;
  value: string;
};
</script>

<script lang="ts">
import { Select as SelectPrimitive } from "bits-ui";

export let disabled = false;
export let items: SelectItem[] = [];
export let name: string | undefined = undefined;
export let placeholder = "";
export let required = false;
export let value = "";
export let onchange:
  | ((event: { currentTarget: { value: string } }) => void)
  | undefined = undefined;
let className = "";

export { className as class };

function handleValueChange(nextValue: string) {
  value = nextValue;
  onchange?.({ currentTarget: { value: nextValue } });
}

$: selectedLabel =
  items.find((item) => item.value === value)?.label || placeholder || items[0]?.label || "";
</script>

<SelectPrimitive.Root
  {disabled}
  {items}
  {name}
  {required}
  type="single"
  {value}
  onValueChange={handleValueChange}
>
  <SelectPrimitive.Trigger
    class={`inline-flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-base-300 bg-base-100 px-3 py-1 text-left text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    data-slot="select-trigger"
    {...$$restProps}
  >
    <span class="truncate">{selectedLabel}</span>
    <span class="text-base-content/50" aria-hidden="true">v</span>
  </SelectPrimitive.Trigger>
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      class="z-50 max-h-80 min-w-[var(--bits-select-anchor-width)] overflow-hidden rounded-xl border border-base-300 bg-base-100 p-1 text-base-content shadow-lg outline-none"
      data-slot="select-content"
      sideOffset={4}
    >
      <SelectPrimitive.Viewport class="grid gap-1">
        {#each items as item}
          <SelectPrimitive.Item
            class="flex cursor-default select-none items-center rounded-md px-3 py-2 text-sm outline-none data-[highlighted]:bg-base-200 data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
            disabled={item.disabled}
            label={item.label}
            value={item.value}
          >
            <span>{item.label}</span>
          </SelectPrimitive.Item>
        {/each}
      </SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
</SelectPrimitive.Root>
