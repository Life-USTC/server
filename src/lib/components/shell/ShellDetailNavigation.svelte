<script lang="ts">
import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
import type { LayoutCopy } from "#lib/shell/layout-server-data.js";
import { goto } from "$app/navigation";
import { page } from "$app/state";
import {
  activeDetailTab,
  detailNavigation,
  legacyDetailDestination,
} from "./detail-navigation";

let {
  pageData,
  pathname,
  copy,
}: {
  pageData: Record<string, unknown>;
  pathname: string;
  copy: LayoutCopy;
} = $props();

const detail = $derived(detailNavigation(pageData, pathname, copy));
const tab = $derived(activeDetailTab(pageData.shellDetail, page.url));
$effect(() => {
  if (!detail) return;
  const destination = legacyDetailDestination(pageData.shellDetail, page.url);
  if (destination) void goto(destination, { replaceState: true });
});
</script>

{#if detail}
  <div class="shrink-0 border-b bg-card px-4 py-2 sm:px-5 lg:px-6" data-testid="shell-detail-navigation">
    <div class="page-frame page-frame-content">
      <div class="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <nav aria-label={copy.shell.currentLocation}>
          <ol class="flex min-w-0 flex-wrap items-center gap-1.5">
            <li><a class="underline-offset-4 hover:underline" href={detail.collection.href}>{detail.collection.label}</a></li>
            <li aria-hidden="true"><ChevronRightIcon class="size-3 text-muted-foreground" /></li>
            <li aria-current={pageData.shellDetail === "section" && tab === "introduction" ? "page" : undefined} class="min-w-0 [overflow-wrap:anywhere]">{detail.current.label}</li>
            {#if pageData.shellDetail !== "section" || tab !== "introduction"}
            <li aria-hidden="true"><ChevronRightIcon class="size-3 text-muted-foreground" /></li>
            <li aria-current="page">{copy.shell.detailNavigation[tab]}</li>
            {/if}
          </ol>
        </nav>
      </div>
    </div>
  </div>
{/if}
