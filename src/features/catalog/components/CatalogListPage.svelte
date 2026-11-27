<script lang="ts">
import type { Snippet } from "svelte";
import ActiveFilters from "#lib/components/ActiveFilters.svelte";
import CollectionPage from "#lib/components/CollectionPage.svelte";
import EndlessScroll from "#lib/components/EndlessScroll.svelte";
import SearchField from "#lib/components/SearchField.svelte";
import { Button } from "#lib/components/ui/button/index.js";
import DemoNotice from "@/features/demo/components/DemoNotice.svelte";
import type { DemoView } from "@/features/demo/lib/demo-types";
import type {
  EndlessScrollLabels,
  EndlessScrollState,
} from "@/lib/navigation/endless-list.svelte";
import type { createFilterDraft } from "@/lib/navigation/filter-draft.svelte";

let {
  title,
  description,
  demo,
  locale,
  endless,
  commonLabels,
  draft,
  activeFilters,
  clearHref,
  filterTitle,
  searchLabel,
  searchPlaceholder,
  formId,
  extraFilters,
  children,
}: {
  title: string;
  description: string;
  demo?: DemoView | null;
  locale: string;
  endless: EndlessScrollState;
  commonLabels: {
    clear: string;
    applyFilters: string;
    endlessScroll: EndlessScrollLabels;
  };
  draft: ReturnType<typeof createFilterDraft>;
  activeFilters: { href: string; label: string }[];
  clearHref: string;
  filterTitle: string;
  searchLabel: string;
  searchPlaceholder: string;
  formId: string;
  extraFilters?: Snippet;
  children: Snippet;
} = $props();
</script>

{#if demo}<DemoNotice {demo} {locale} />{/if}

{#snippet pagination()}
  <EndlessScroll state={endless} labels={commonLabels.endlessScroll} />
{/snippet}

<CollectionPage {title} {description} footer={endless.hasMore ? pagination : undefined}>
  {#snippet toolbar()}
    <div class="grid w-full min-w-0 gap-3" data-slot="table-filter-toolbar">
      <form id={formId} action={clearHref} method="get" onsubmit={draft.submit} class="compact-toolbar flex min-w-0 flex-wrap items-center gap-2">
        <SearchField id={formId + "-search"} name="search" label={searchLabel} placeholder={searchPlaceholder} bind:value={() => draft.values.search ?? "", (value) => draft.update({ search: value })} />
        {#each Object.entries(draft.values) as [name, value]}
          {#if name !== "search" && name !== "page" && value}<input type="hidden" {name} {value} />{/if}
        {/each}
        <Button type="submit">{commonLabels.applyFilters}</Button>
      </form>
      {#if extraFilters}<div class="flex flex-wrap items-center gap-x-4 gap-y-2">{@render extraFilters()}</div>{/if}
      <ActiveFilters items={activeFilters} ariaLabel={filterTitle} {clearHref} clearLabel={commonLabels.clear} />
    </div>
  {/snippet}
  {@render children()}
</CollectionPage>
