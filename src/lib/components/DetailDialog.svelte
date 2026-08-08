<script lang="ts">
import type { Snippet } from "svelte";
import * as Dialog from "$lib/components/ui/dialog/index.js";
import { ScrollArea } from "$lib/components/ui/scroll-area/index.js";
import { cn } from "$lib/utils.js";

type Props = {
  /** Secondary column, e.g. a discussion rail. Widens the dialog when set. */
  aside?: Snippet;
  badges?: Snippet;
  body: Snippet;
  class?: string;
  footer?: Snippet;
  footerClass?: string;
  onClose: () => void;
  open?: boolean;
  /** Lets callers keep one footer snippet and drop the bar in some states. */
  showFooter?: boolean;
  subtitle?: string;
  title: string;
};

let {
  aside,
  badges,
  body,
  class: className = "",
  footer,
  footerClass = "",
  onClose,
  open = true,
  showFooter = true,
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
    <Dialog.Header class="shrink-0 gap-1.5 border-b px-5 py-4 pr-14 sm:px-6">
      <div class="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
        <Dialog.Title class="min-w-0 break-words text-lg leading-tight">
          {title}
        </Dialog.Title>
        {#if badges}{@render badges()}{/if}
      </div>
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

    {#if footer && showFooter}
      <Dialog.Footer
        class={cn("mx-0 mb-0 shrink-0 rounded-none px-5 py-3 sm:px-6", footerClass)}
      >
        {@render footer()}
      </Dialog.Footer>
    {/if}
  </Dialog.Content>
</Dialog.Root>
