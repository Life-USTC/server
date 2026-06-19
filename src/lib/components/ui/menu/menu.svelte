<script lang="ts">
import { DropdownMenu as MenuPrimitive } from "bits-ui";
import { onMount } from "svelte";

export let align: "left" | "right" = "left";
export let onClose: () => void = () => {};
let className = "";
let menuElement: HTMLElement;

export { className as class };

$: alignmentClass = align === "right" ? "right-0" : "left-0";

onMount(() => {
  function handlePointerDown(event: PointerEvent) {
    if (menuElement && !menuElement.contains(event.target as Node)) {
      onClose();
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
    document.removeEventListener("pointerdown", handlePointerDown);
    document.removeEventListener("keydown", handleKeydown);
  };
});
</script>

<MenuPrimitive.Root open={true}>
  <div
    bind:this={menuElement}
    class={`absolute ${alignmentClass} z-20 mt-1 w-40 ${className}`}
  >
    <MenuPrimitive.ContentStatic
      class="grid w-full gap-1 rounded-md border border-base-300 bg-base-100 p-1 shadow-lg outline-none"
      data-slot="menu"
      loop
      {...$$restProps}
    >
      <slot />
    </MenuPrimitive.ContentStatic>
  </div>
</MenuPrimitive.Root>
