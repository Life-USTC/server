<script lang="ts">
import { catalogLinkVisitHref } from "@/features/catalog-links/lib/catalog-links";
import { WORKSPACE_OVERVIEW_PREVIEW_LIMIT } from "@/features/workspace/lib/overview-preview";
import type {
  WorkspaceCopy,
  WorkspaceLinkPinAction,
  WorkspaceOverviewLinkItem,
} from "@/features/workspace/lib/workspace-controller-helpers";
import * as Empty from "$lib/components/ui/empty/index.js";
import LinksTabPinButton from "./LinksTabPinButton.svelte";
import OverviewSection from "./OverviewSection.svelte";
import type { WorkspaceCalendarTabHref } from "./workspace-calendar-component-types";

export let workspaceCopy: WorkspaceCopy;
export let workspaceTabHref: WorkspaceCalendarTabHref;
export let linkIconLabel: (icon: string) => string;
export let links: WorkspaceOverviewLinkItem[];
export let submitWorkspaceLinkPin: (
  slug: string,
  action: "pin" | "unpin",
) => void;
export let updatingCatalogLinkSlug: string | null;

const previewLimit = WORKSPACE_OVERVIEW_PREVIEW_LIMIT;
$: previewLinks = links.slice(0, previewLimit);

function pinLabel(link: WorkspaceOverviewLinkItem) {
  return link.isPinned
    ? workspaceCopy.linkHub.unpin
    : workspaceCopy.linkHub.pin;
}

function pinAction(link: WorkspaceOverviewLinkItem): WorkspaceLinkPinAction {
  return link.isPinned ? "unpin" : "pin";
}
</script>

<OverviewSection
  href="/catalog/links"
  testId="workspace-overview-links"
  title={workspaceCopy.linkHub.title}
  viewAllHref="/catalog/links"
  viewAllLabel={workspaceCopy.viewAll as string}
  viewAllVisible={links.length > previewLimit}
>
  {#if previewLinks.length > 0}
    <div class="grid min-w-0 grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {#each previewLinks as link}
        <div class="group relative min-w-0">
          <a
            class="flex w-full min-w-0 items-start gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-muted/50"
            class:pe-10={true}
            href={catalogLinkVisitHref(link.slug)}
            rel="noopener noreferrer"
            target="_blank"
          >
            <span
              aria-hidden="true"
              class="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-medium"
            >
              {linkIconLabel(link.icon)}
            </span>
            <span class="grid min-w-0 gap-0.5">
              <span class="truncate font-medium text-sm">{link.title}</span>
              <span class="line-clamp-2 text-muted-foreground text-xs"
                >{link.description}</span
              >
            </span>
          </a>
          <div
            class={`absolute top-2 right-1 ${link.isPinned ? "" : "md:pointer-events-none md:opacity-0 md:transition-opacity md:group-focus-within:pointer-events-auto md:group-focus-within:opacity-100 md:group-hover:pointer-events-auto md:group-hover:opacity-100"}`}
          >
            <LinksTabPinButton
              {link}
              linkReturnTo={workspaceTabHref("overview")}
              {pinAction}
              {pinLabel}
              {submitWorkspaceLinkPin}
              {updatingCatalogLinkSlug}
            />
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <Empty.Root class="min-h-20 border-0 px-2 py-6">
      <Empty.Header>
        <Empty.Description>{workspaceCopy.linkHub.empty}</Empty.Description>
      </Empty.Header>
    </Empty.Root>
  {/if}
</OverviewSection>
