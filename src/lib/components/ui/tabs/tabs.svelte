<script lang="ts">
import { setContext } from "svelte";
import {
  type TabsListLabelContext,
  tabsListLabelContext,
} from "./tabs-context";

let className = "";
let rootProps: Record<string, unknown> = {};

export { className as class };

const labelContext: TabsListLabelContext = {
  getLabel: () => {
    const value = ($$restProps as Record<string, unknown>)["aria-label"];
    return typeof value === "string" && value.length > 0 ? value : undefined;
  },
};

setContext(tabsListLabelContext, labelContext);

$: {
  const { "aria-label": _label, ...rest } = $$restProps as Record<
    string,
    unknown
  >;
  rootProps = rest;
}
</script>

<div class={`grid min-w-0 gap-4 ${className}`} data-slot="tabs" {...rootProps}>
  <slot />
</div>
