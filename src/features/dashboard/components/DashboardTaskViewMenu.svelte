<script lang="ts">
import LayoutGrid from "@lucide/svelte/icons/layout-grid";
import List from "@lucide/svelte/icons/list";
import SlidersHorizontal from "@lucide/svelte/icons/sliders-horizontal";
import { Button } from "$lib/components/ui/button/index.js";
import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";

export let cardLabel: string;
export let label: string;
export let listLabel: string;
export let setView: (view: "cards" | "list") => void;
export let testId: string;
export let view: "cards" | "list";

function setViewValue(value: string) {
  if (value === "cards" || value === "list") setView(value);
}
</script>

<DropdownMenu.Root>
  <DropdownMenu.Trigger>
    {#snippet child({ props })}
      <Button
        {...props}
        aria-label={label}
        class="size-11 md:hidden"
        data-testid={testId}
        size="icon"
        type="button"
        variant="outline"
      >
        <SlidersHorizontal />
      </Button>
    {/snippet}
  </DropdownMenu.Trigger>
  <DropdownMenu.Content align="end" class="w-44" preventScroll={false}>
    <DropdownMenu.Label>{label}</DropdownMenu.Label>
    <DropdownMenu.Group>
      <DropdownMenu.RadioGroup onValueChange={setViewValue} value={view}>
        <DropdownMenu.RadioItem value="cards">
          <LayoutGrid />
          {cardLabel}
        </DropdownMenu.RadioItem>
        <DropdownMenu.RadioItem value="list">
          <List />
          {listLabel}
        </DropdownMenu.RadioItem>
      </DropdownMenu.RadioGroup>
    </DropdownMenu.Group>
  </DropdownMenu.Content>
</DropdownMenu.Root>
