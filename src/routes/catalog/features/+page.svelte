<script lang="ts">
import CollectionPage from "#lib/components/CollectionPage.svelte";
import FilterToolbar from "#lib/components/FilterToolbar.svelte";
import SearchField from "#lib/components/SearchField.svelte";
import { filterShellFeatures } from "#lib/components/shell/feature-search.js";
import { buildShellFeatureGroups } from "#lib/components/shell/navigation.js";
import SettingsGlyph from "#lib/components/shell/SettingsGlyph.svelte";
import { Button } from "#lib/components/ui/button/index.js";
import * as Empty from "#lib/components/ui/empty/index.js";
import * as Item from "#lib/components/ui/item/index.js";
import { getShellViewer } from "#lib/shell/shell-viewer.js";
import type { PageData } from "./$types";

export let data: PageData;
const shellViewer = getShellViewer();
let query = "";
$: copy = data.copy.nav.hub;
$: viewer = $shellViewer.viewer;
$: groups = filterShellFeatures(
  buildShellFeatureGroups(
    data.copy,
    viewer ? { signedIn: true, isAdmin: viewer.isAdmin } : null,
  ),
  query,
);
</script>

<svelte:head><title>{copy.title} - Life@USTC</title></svelte:head>

<CollectionPage title={copy.title} description={copy.description} panel={false}>
  {#snippet toolbar()}
    <FilterToolbar>
      {#snippet primary()}
        <SearchField id="feature-search" label={copy.searchLabel} placeholder={copy.searchPlaceholder} bind:value={query} />
        {#if query}
          <Button variant="outline" onclick={() => { query = ""; }}>{copy.clearSearch}</Button>
        {/if}
      {/snippet}
    </FilterToolbar>
  {/snippet}

  <!--
    This page is the "what exists" surface; the anonymous home page (#1300,
    #1302) is the "what is happening" one. So a destination is one row — icon,
    name, one line of purpose — rather than a card, and the rows that own
    sub-destinations list them underneath instead of in a card footer. Only
    some rows have sub-destinations, and the footer band they used to sit in
    stretched every card beside them to match.
  -->
  <div class="grid gap-5" data-feature-hub>
    {#if $shellViewer.status === "ready" && !viewer}
      <p class="text-muted-foreground text-sm">
        {copy.signInPrompt}
        <Button href="/account/sign-in?callbackUrl=%2Fcatalog%2Ffeatures" variant="link" class="h-auto min-h-6 p-0 align-baseline md:min-h-6">{data.copy.menu.signIn}</Button>
      </p>
    {/if}
    {#each groups as group (group.id)}
      <!--
        From md the group name moves into a left rail: it stops costing a line
        of its own and the directory reads as an index down the page.
      -->
      <section aria-labelledby={`features-${group.id}`} class="grid gap-2 md:grid-cols-[7rem_minmax(0,1fr)] md:items-start md:gap-x-6">
        <h2 id={`features-${group.id}`} class="font-medium text-muted-foreground text-sm md:pt-2.5">{group.label}</h2>
        <!--
          items-start, so a row with sub-destinations never stretches the rows
          beside it; nothing is framed, so the unused space is not a void.
        -->
        <div class="grid items-start gap-x-4 gap-y-1 sm:grid-cols-2 xl:grid-cols-3">
          {#each group.features as feature (feature.id)}
            {@const extras = feature.items?.filter((item) => item.href !== feature.href) ?? []}
            <div class="grid min-w-0 gap-0.5" data-feature-entry>
              <Item.Root size="sm" class="items-start py-2">
                {#snippet child({ props })}
                  <a href={feature.href} {...props}>
                    <Item.Media variant="icon" class="text-muted-foreground">
                      {#if feature.glyph}
                        <SettingsGlyph name={feature.glyph} />
                      {:else if feature.icon}
                        {@const Icon = feature.icon}
                        <Icon class="size-4 shrink-0" aria-hidden="true" />
                      {/if}
                    </Item.Media>
                    <Item.Content class="gap-0.5">
                      <Item.Title class="group-hover/item:underline">{feature.label}</Item.Title>
                      <Item.Description class="text-xs">{feature.description}</Item.Description>
                    </Item.Content>
                  </a>
                {/snippet}
              </Item.Root>
              {#if extras.length > 0}
                <!-- Aligned under the row description: 0.75rem row padding + 1rem icon + 0.625rem gap. -->
                <div class="flex flex-wrap gap-1 pl-[2.375rem]">
                  {#each extras as item (item.href)}
                    <Button href={item.href} variant="outline" size="xs" class="min-h-6 font-normal text-muted-foreground md:min-h-6">{item.label}</Button>
                  {/each}
                </div>
              {/if}
            </div>
          {/each}
        </div>
      </section>
    {:else}
      <Empty.Root role="status">
        <Empty.Header><Empty.Title>{copy.empty}</Empty.Title></Empty.Header>
        <Empty.Content><Button variant="outline" onclick={() => { query = ""; }}>{copy.clearSearch}</Button></Empty.Content>
      </Empty.Root>
    {/each}
  </div>
</CollectionPage>
