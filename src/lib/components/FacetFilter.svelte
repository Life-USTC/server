<script lang="ts">
import PlusCircleIcon from "@lucide/svelte/icons/circle-plus";
import { tableFilterValues } from "@/lib/table-filters";
import { Badge } from "./ui/badge/index.js";
import { Button } from "./ui/button/index.js";
import { Checkbox } from "./ui/checkbox/index.js";
import * as Command from "./ui/command/index.js";
import * as Popover from "./ui/popover/index.js";

let {
  label,
  options,
  value,
  onchange,
  clearLabel,
  noResults,
}: {
  label: string;
  options: { value: string; label: string }[];
  value?: string;
  onchange: (value: string) => void;
  clearLabel: string;
  noResults: string;
} = $props();
let open = $state(false);
const selected = $derived(tableFilterValues(value));
function toggle(key: string) {
  onchange(
    (selected.includes(key)
      ? selected.filter((item) => item !== key)
      : [...selected, key]
    ).join(","),
  );
}
</script>

<Popover.Root bind:open>
  <Popover.Trigger>
    {#snippet child({ props })}
      <Button
        {...props}
        type="button"
        variant="outline"
        role="combobox"
        aria-label={label}
        aria-expanded={open}
      >
        <PlusCircleIcon data-icon="inline-start" />{label}
        {#if selected.length}<Badge variant="secondary">
            {selected.length}
          </Badge>{/if}
      </Button>
    {/snippet}
  </Popover.Trigger>
  <Popover.Content align="start" class="w-64 p-0">
    <Command.Root>
      <Command.Input aria-label={label} placeholder={label} />
      <Command.List>
        <Command.Empty>{noResults}</Command.Empty>
        <Command.Group>
          {#each options as option (option.value)}
            <Command.Item
              value={option.value}
              aria-checked={selected.includes(option.value)}
              keywords={[option.label]}
              onSelect={() => toggle(option.value)}
            >
              <span inert>
                <Checkbox
                  checked={selected.includes(option.value)}
                  tabindex={-1}
                  aria-hidden="true"
                  class="pointer-events-none"
                />
              </span>
              {option.label}
            </Command.Item>
          {/each}
        </Command.Group>
      </Command.List>
    </Command.Root>
    {#if selected.length}<Button
        type="button"
        class="w-full"
        variant="ghost"
        onclick={() => onchange("")}
      >
        {clearLabel}
      </Button>{/if}
  </Popover.Content>
</Popover.Root>
