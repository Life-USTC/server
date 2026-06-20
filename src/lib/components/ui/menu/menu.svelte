<script lang="ts">
import { onMount } from "svelte";

export let align: "left" | "right" = "left";
export let onClose: () => void = () => {};
let className = "";
let menuElement: HTMLElement;

export { className as class };

$: alignmentClass = align === "right" ? "right-0" : "left-0";

onMount(() => {
  let closeTimer: number | null = null;

  function scheduleClose() {
    if (closeTimer) {
      window.clearTimeout(closeTimer);
    }
    closeTimer = window.setTimeout(() => {
      closeTimer = null;
      onClose();
    }, 0);
  }

  function handlePointerDown(event: PointerEvent) {
    if (menuElement && !menuElement.contains(event.target as Node)) {
      scheduleClose();
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
    }
  }

  document.addEventListener("pointerdown", handlePointerDown);
  document.addEventListener("keydown", handleKeydown);

  return () => {
    if (closeTimer) {
      window.clearTimeout(closeTimer);
    }
    document.removeEventListener("pointerdown", handlePointerDown);
    document.removeEventListener("keydown", handleKeydown);
  };
});
</script>

<div
  bind:this={menuElement}
  class={`absolute ${alignmentClass} z-20 mt-1 w-40 ${className}`}
>
  <div
    class="grid w-full gap-1 rounded-md border border-base-300 bg-base-100 p-1 shadow-lg outline-none"
    data-slot="menu"
    role="menu"
    tabindex="-1"
    {...$$restProps}
  >
    <slot />
  </div>
</div>
