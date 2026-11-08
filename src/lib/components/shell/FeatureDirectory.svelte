<script lang="ts">
import FilterToolbar from "#lib/components/FilterToolbar.svelte";
import SearchField from "#lib/components/SearchField.svelte";
import { filterShellFeatures } from "#lib/components/shell/feature-search.js";
import { buildShellFeatureGroups } from "#lib/components/shell/navigation.js";
import SettingsGlyph from "#lib/components/shell/SettingsGlyph.svelte";
import { Button } from "#lib/components/ui/button/index.js";
import * as Empty from "#lib/components/ui/empty/index.js";
import * as Item from "#lib/components/ui/item/index.js";
import type { LayoutCopy } from "#lib/shell/layout-server-data.js";
import { getShellViewer } from "#lib/shell/shell-viewer.js";
import { demoNavigationLink } from "@/features/demo/lib/demo-navigation";

/**
 * The product directory: every destination the shell knows about, grouped by
 * intent and searchable. It renders on `/`, which is cached and
 * viewer-independent, so the signed-in and admin groups are added here on the
 * client from the shell viewer store rather than from the page load.
 */
let {
  copy,
  searchId = "feature-search",
  signInCallbackUrl = "/",
}: {
  copy: LayoutCopy;
  /** Distinct per mount so the label/input association stays unique. */
  searchId?: string;
  signInCallbackUrl?: string;
} = $props();

const shellViewer = getShellViewer();
let query = $state("");

const hub = $derived(copy.nav.hub);
const viewer = $derived($shellViewer.viewer);
const demo = $derived($shellViewer.demo);
const groups = $derived(
  filterShellFeatures(
    buildShellFeatureGroups(
      copy,
      demo
        ? { signedIn: true, isAdmin: false }
        : viewer
          ? { signedIn: true, isAdmin: viewer.isAdmin }
          : null,
    ).map((group) => ({
      ...group,
      features: group.features.map((feature) =>
        demo ? demoNavigationLink(feature, demo.unavailableReason) : feature,
      ),
    })),
    query,
  ),
);
</script>

<div class="grid min-w-0 gap-4" data-feature-directory>
  {#if demo}
    <p id={`${searchId}-demo-unavailable`} class="text-muted-foreground text-sm">{demo.unavailableReason}</p>
  {/if}
  <FilterToolbar>
    {#snippet primary()}
      <SearchField
        id={searchId}
        label={hub.searchLabel}
        placeholder={hub.searchPlaceholder}
        bind:value={query}
      />
      {#if query}
        <Button variant="outline" onclick={() => { query = ""; }}>{hub.clearSearch}</Button>
      {/if}
    {/snippet}
  </FilterToolbar>

  <!--
    This directory is the "what exists" surface; the campus information above it
    is the "what is happening" one. So a destination is one row — icon, name,
    one line of purpose — rather than a card, and the rows that own
    sub-destinations list them underneath instead of in a card footer. Only
    some rows have sub-destinations, and the footer band they used to sit in
    stretched every card beside them to match.
  -->
  <div class="grid gap-5" data-feature-hub>
    {#if $shellViewer.status === "ready" && !viewer && !demo}
      <p class="text-muted-foreground text-sm">
        {hub.signInPrompt}
        <Button href={`/account/sign-in?callbackUrl=${encodeURIComponent(signInCallbackUrl)}`} variant="link" class="h-auto min-h-6 p-0 align-baseline underline md:min-h-6">{copy.menu.signIn}</Button>
      </p>
    {/if}
    {#each groups as group (group.id)}
      <!--
        From md the group name moves into a left rail: it stops costing a line
        of its own and the directory reads as an index down the page.
      -->
      <section aria-labelledby={`${searchId}-${group.id}`} class="grid gap-2 md:grid-cols-[7rem_minmax(0,1fr)] md:items-start md:gap-x-6">
        <h3 id={`${searchId}-${group.id}`} class="font-medium text-muted-foreground text-sm md:pt-2.5">{group.label}</h3>
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
                  <svelte:element this={feature.disabledReason ? "div" : "a"} href={feature.disabledReason ? undefined : feature.href} role={feature.disabledReason ? "link" : undefined} aria-disabled={feature.disabledReason ? true : undefined} aria-describedby={feature.disabledReason ? `${searchId}-demo-unavailable` : undefined} tabindex={feature.disabledReason ? -1 : undefined} {...props}>
                    <Item.Media variant="icon" class="text-muted-foreground">
                      {#if feature.glyph}
                        <SettingsGlyph name={feature.glyph} />
                      {:else if feature.icon}
                        {@const Icon = feature.icon}
                        <Icon class="size-4 shrink-0" aria-hidden="true" />
                      {/if}
                    </Item.Media>
                    <Item.Content class="gap-0.5">
                      <Item.Title class={feature.disabledReason ? "" : "group-hover/item:underline"}>{feature.label}</Item.Title>
                      <Item.Description class="text-xs">{feature.description}</Item.Description>
                      {#if feature.disabledReason}<Item.Description class="text-xs">{feature.disabledReason}</Item.Description>{/if}
                    </Item.Content>
                  </svelte:element>
                {/snippet}
              </Item.Root>
              {#if extras.length > 0}
                <!-- Aligned under the row description: 0.75rem row padding + 1rem icon + 0.625rem gap. -->
                <div class="flex flex-wrap gap-1 pl-[2.375rem]">
                  {#each extras as item (item.href)}
                    <Button href={item.disabledReason ? undefined : item.href} disabled={Boolean(item.disabledReason)} aria-describedby={item.disabledReason ? `${searchId}-demo-unavailable` : undefined} variant="outline" size="xs" class="min-h-6 font-normal text-muted-foreground md:min-h-6">{item.label}</Button>
                  {/each}
                </div>
              {/if}
            </div>
          {/each}
        </div>
      </section>
    {:else}
      <Empty.Root role="status">
        <Empty.Header><Empty.Title>{hub.empty}</Empty.Title></Empty.Header>
        <Empty.Content><Button variant="outline" onclick={() => { query = ""; }}>{hub.clearSearch}</Button></Empty.Content>
      </Empty.Root>
    {/each}
  </div>
</div>
