<script lang="ts">
export let visitCountLabel: string | undefined = undefined;
export let readOnlyReason: string | undefined = undefined;

import { cn } from "#lib/utils.js";
import { catalogLinkVisitHref } from "@/features/catalog-links/lib/catalog-links";
import type { WorkspaceOverviewLinkItem } from "@/features/workspace/lib/workspace-controller-helpers";

export let link: WorkspaceOverviewLinkItem;

let className = "";

export { className as class };
</script>

<svelte:element
            this={readOnlyReason ? "button" : "a"}
            disabled={readOnlyReason ? true : undefined}
            type={readOnlyReason ? "button" : undefined}
            title={readOnlyReason}
  class={cn(
    "flex h-full min-h-12 min-w-0 w-full items-center overflow-hidden px-3 text-left text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset",
    className,
  )}
  href={readOnlyReason ? undefined : catalogLinkVisitHref(link.slug)}
  rel="noopener noreferrer"
  target="_blank"
>
  {#if readOnlyReason && visitCountLabel}
    <span class="grid min-w-0 gap-0.5"><slot /><span class="text-muted-foreground text-xs">{visitCountLabel}: {link.clickCount}</span></span>
  {:else}<slot />{/if}
</svelte:element>
