<script lang="ts">
import { getContext } from "svelte";
import {
  type TabsListLabelContext,
  tabsListLabelContext,
} from "./tabs-context";

export let role = "group";
let className = "";

export { className as class };

const rootLabelContext = getContext<TabsListLabelContext | undefined>(
  tabsListLabelContext,
);

function explicitListLabel() {
  const value = ($$restProps as Record<string, unknown>)["aria-label"];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

$: listLabel = explicitListLabel() ?? rootLabelContext?.getLabel();
</script>

<div
  class={`inline-flex max-w-full w-fit items-center gap-1 overflow-x-auto rounded-xl border border-base-300 bg-base-100 p-1 ${className}`}
  data-slot="tabs-list"
  {...$$restProps}
  aria-label={listLabel}
  {role}
>
  <slot />
</div>
