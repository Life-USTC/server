<script lang="ts">
import type { Snippet } from "svelte";
import * as Dialog from "$lib/components/ui/dialog/index.js";
import { ScrollArea } from "$lib/components/ui/scroll-area/index.js";
import { cn } from "$lib/utils.js";

type Props = {
  /**
   * Discussion column. Per `docs/contracts/_ui.json` layout principles, popups
   * with discussion keep details on the left and discussion on the right on
   * desktop, and stack in that order on mobile.
   */
  aside?: Snippet;
  body: Snippet;
  class?: string;
  onClose: () => void;
  open?: boolean;
  subtitle?: string;
  title: string;
};

let {
  aside,
  body,
  class: className = "",
  onClose,
  open = true,
  subtitle = "",
  title,
}: Props = $props();
</script>

<Dialog.Root
  {open}
  onOpenChange={(next) => {
    if (!next) onClose();
  }}
>
  <Dialog.Content
    class={cn(
      "flex max-h-[calc(100vh-2rem)] flex-col gap-0 overflow-hidden p-0",
      "[&>[data-slot=dialog-close]]:top-3.5 [&>[data-slot=dialog-close]]:right-3.5",
      aside ? "sm:max-w-5xl" : "sm:max-w-lg",
      className,
    )}
  >
    <Dialog.Header class="shrink-0 gap-1 border-b px-5 py-4 pr-14 sm:px-6">
      <Dialog.Title class="min-w-0 break-words leading-tight">
        {title}
      </Dialog.Title>
      {#if subtitle}
        <Dialog.Description>{subtitle}</Dialog.Description>
      {/if}
    </Dialog.Header>

    <ScrollArea class="min-h-0 flex-1">
      <div class={cn(aside && "grid lg:grid-cols-[minmax(0,1fr)_minmax(19rem,22rem)]")}>
        <div
          class="grid min-w-0 content-start gap-4 p-5 sm:p-6"
          data-slot="detail-dialog-body"
        >
          {@render body()}
        </div>
        {#if aside}
          <div
            class="min-w-0 border-t bg-muted/30 p-5 sm:p-6 lg:border-t-0 lg:border-l"
            data-slot="detail-dialog-aside"
          >
            {@render aside()}
          </div>
        {/if}
      </div>
    </ScrollArea>
  </Dialog.Content>
</Dialog.Root>
