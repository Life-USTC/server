<script lang="ts">
import { getContext } from "svelte";
import {
  type TabsListLabelContext,
  tabsListLabelContext,
} from "./tabs-context";

export let role = "group";
export let semantic = false;
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
$: listRole = semantic ? "tablist" : role;

function handleKeydown(event: KeyboardEvent) {
  if (
    !semantic ||
    !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
  ) {
    return;
  }

  const list = event.currentTarget as HTMLDivElement;
  const tabs = Array.from(
    list.querySelectorAll<HTMLButtonElement>(
      '[role="tab"]:not([aria-disabled="true"])',
    ),
  );
  if (tabs.length === 0) return;

  const currentIndex = tabs.indexOf(
    document.activeElement as HTMLButtonElement,
  );
  const fallbackIndex = tabs.findIndex(
    (tab) => tab.getAttribute("aria-selected") === "true",
  );
  const startIndex =
    currentIndex >= 0 ? currentIndex : Math.max(fallbackIndex, 0);
  const nextIndex =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? tabs.length - 1
        : (startIndex + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) %
          tabs.length;

  event.preventDefault();
  tabs[nextIndex]?.focus();
}
</script>

<div
  class={`inline-flex max-w-full w-fit items-center gap-1 overflow-x-auto rounded-xl border border-base-300 bg-base-100 p-1 ${className}`}
  data-slot="tabs-list"
  {...$$restProps}
  aria-label={listLabel}
  role={listRole}
  onkeydown={handleKeydown}
>
  <slot />
</div>
