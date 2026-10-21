<script lang="ts">
import ArrowRightIcon from "@lucide/svelte/icons/arrow-right";
import CollectionPage from "#lib/components/CollectionPage.svelte";
import FilterToolbar from "#lib/components/FilterToolbar.svelte";
import SearchField from "#lib/components/SearchField.svelte";
import { filterShellFeatures } from "#lib/components/shell/feature-search.js";
import { buildShellFeatureGroups } from "#lib/components/shell/navigation.js";
import SettingsGlyph from "#lib/components/shell/SettingsGlyph.svelte";
import { Button } from "#lib/components/ui/button/index.js";
import * as Card from "#lib/components/ui/card/index.js";
import * as Empty from "#lib/components/ui/empty/index.js";
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

  <div class="grid gap-6" data-feature-hub>
    {#if $shellViewer.status === "ready" && !viewer}
      <p class="text-muted-foreground text-sm">
        {copy.signInPrompt}
        <Button href="/account/sign-in?callbackUrl=%2Fcatalog%2Ffeatures" variant="link">{data.copy.menu.signIn}</Button>
      </p>
    {/if}
    {#each groups as group (group.id)}
      <section aria-labelledby={`features-${group.id}`} class="grid gap-3">
        <h2 id={`features-${group.id}`} class="font-medium text-sm text-muted-foreground">{group.label}</h2>
        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {#each group.features as feature (feature.id)}
            <Card.Root class="gap-3 py-4">
              <Card.Header class="px-4">
                <Card.Title>
                  <a href={feature.href} aria-label={feature.label} class="flex min-h-11 items-center gap-3 rounded-md outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">
                    {#if feature.glyph}
                      <SettingsGlyph name={feature.glyph} />
                    {:else if feature.icon}
                      {@const Icon = feature.icon}
                      <Icon class="size-5 shrink-0" aria-hidden="true" />
                    {/if}
                    <span class="flex-1">{feature.label}</span>
                    <ArrowRightIcon class="size-4 shrink-0" aria-hidden="true" />
                  </a>
                </Card.Title>
                <Card.Description>{feature.description}</Card.Description>
              </Card.Header>
              {#if feature.items?.some((item) => item.href !== feature.href)}
                <Card.Footer class="flex flex-wrap gap-x-3 px-4">
                  {#each feature.items.filter((item) => item.href !== feature.href) as item}
                    <Button href={item.href} variant="link" class="h-auto min-h-11 whitespace-normal p-0 text-left md:min-h-6">{item.label}</Button>
                  {/each}
                </Card.Footer>
              {/if}
            </Card.Root>
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
