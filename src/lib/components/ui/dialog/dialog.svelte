<script lang="ts">
import { Dialog as DialogPrimitive } from "bits-ui";
import { cn } from "@/lib/utils";

export let open = false;
export let onOpenChange: ((open: boolean) => void) | undefined = undefined;
let className = "";

export { className as class };

function handleOpenChange(nextOpen: boolean) {
  open = nextOpen;
  onOpenChange?.(nextOpen);
}
</script>

<DialogPrimitive.Root {open} onOpenChange={handleOpenChange}>
  {#if open}
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        class="fixed inset-0 z-50 bg-black/45 backdrop-blur-[1px]"
        data-slot="dialog-overlay"
      />
      <DialogPrimitive.Content
        class={cn(
          "fixed left-1/2 top-1/2 z-50 grid max-h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto rounded-md border border-base-300 bg-base-100 p-0 text-base-content shadow-xl outline-none",
          className,
        )}
        data-slot="dialog-popup"
        {...$$restProps}
      >
        <slot />
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  {/if}
</DialogPrimitive.Root>
