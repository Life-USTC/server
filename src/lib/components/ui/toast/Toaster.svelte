<script lang="ts">
  import { Toast, ToastRegion, ToastTitle } from "@ui-sdk/svelte/toast";
  import CircleCheckIcon from "@lucide/svelte/icons/circle-check";
  import OctagonXIcon from "@lucide/svelte/icons/octagon-x";
  import { resolveMobileToastBottomOffset } from "#lib/components/shell/layout-shell.js";
</script>

<ToastRegion
  align="end"
  side="bottom"
  class="shell-toaster"
  style={`--shell-toast-without-primary: ${resolveMobileToastBottomOffset(false)}; --shell-toast-with-primary: ${resolveMobileToastBottomOffset(true)}`}
>
  {#snippet children(notification)}
    <Toast class="flex items-center gap-2 rounded-lg border bg-popover p-4 text-sm text-popover-foreground shadow-md">
      {#if notification.type === "error"}
        <OctagonXIcon class="size-4 shrink-0" aria-hidden="true" />
      {:else if notification.type === "success"}
        <CircleCheckIcon class="size-4 shrink-0" aria-hidden="true" />
      {/if}
      <ToastTitle />
    </Toast>
  {/snippet}
</ToastRegion>

<style>
  :global(.shell-toaster) {
    position: fixed;
    inset: auto 24px 24px auto;
    display: flex;
    flex-direction: column-reverse;
    gap: 0.5rem;
    width: 22rem;
    max-width: calc(100vw - 2rem);
    margin: 0;
    padding: 0;
    border: 0;
    background: transparent;
    pointer-events: none;
  }

  @media (max-width: 600px) {
    :global(.shell-toaster) {
      right: 1rem;
      bottom: var(--shell-toast-without-primary);
    }
  }

  @media (max-width: 1023px) {
    :global(html:has([data-mobile-primary-navigation]) .shell-toaster) {
      bottom: var(--shell-toast-with-primary);
    }
  }
</style>
