<script lang="ts">
import CollectionEmpty from "#lib/components/CollectionEmpty.svelte";
import CollectionListShell from "#lib/components/CollectionListShell.svelte";
import CollectionTableShell from "#lib/components/CollectionTableShell.svelte";
import MobileListCard from "#lib/components/MobileListCard.svelte";
import ResponsiveCollection from "#lib/components/ResponsiveCollection.svelte";
import TableFieldFilter from "#lib/components/TableFieldFilter.svelte";
import TruncatedText from "#lib/components/TruncatedText.svelte";
import { Button } from "#lib/components/ui/button/index.js";
import * as Item from "#lib/components/ui/item/index.js";
import * as Table from "#lib/components/ui/table/index.js";
import { formatBusVersionEffectiveRange } from "@/features/admin/lib/admin-bus-formatters";
import { getWorkspacePageCopy } from "@/lib/shell/page-copy";
import { matchTableFilter, type TableFilterField } from "@/lib/table-filters";
import {
  campusTimestampFormatter,
  formatShanghaiDate,
} from "@/lib/time/shanghai-format";
import AdminBusVersionActions from "./AdminBusVersionActions.svelte";
import AdminBusVersionStatusBadge from "./AdminBusVersionStatusBadge.svelte";
import type {
  AdminBusCopy,
  AdminBusEnhancedAction,
  AdminBusVersion,
} from "./admin-bus-types";

interface Props {
  copy: AdminBusCopy;
  enhancedAction: AdminBusEnhancedAction;
  locale: string;
  onDelete: (version: AdminBusVersion) => void;
  pendingAction: string | null;
  versions: AdminBusVersion[];
}

let { copy, enhancedAction, locale, onDelete, pendingAction, versions }: Props =
  $props();
let draft = $state<Record<string, string>>({});
let applied = $state<Record<string, string>>({});
const common = $derived(
  getWorkspacePageCopy(locale === "en-us" ? "en-us" : "zh-cn").common,
);
const dateTimeFormatter = $derived(campusTimestampFormatter(locale));
const columns = $derived<TableFilterField[][]>([
  [
    { name: "title", label: copy.colTitle },
    { name: "sourceMessage", label: copy.filterSource },
  ],
  [{ name: "key", label: copy.colKey }],
  [
    {
      name: "tripCount",
      label: copy.colTrips,
      type: "number",
      min: 0,
      step: 1,
    },
  ],
  [
    { name: "effectiveFrom", label: copy.filterEffectiveFrom, type: "date" },
    { name: "effectiveUntil", label: copy.filterEffectiveUntil, type: "date" },
  ],
  [{ name: "importedAt", label: copy.colImported, type: "date" }],
  [
    {
      name: "isEnabled",
      label: copy.colStatus,
      options: [
        { value: "true", label: copy.statusActive },
        { value: "false", label: copy.statusInactive },
      ],
    },
  ],
]);
const visibleVersions = $derived(
  versions.filter((version) =>
    columns.flat().every((field) => {
      const value = version[field.name as keyof AdminBusVersion];
      return matchTableFilter(
        field.type === "date"
          ? value
            ? formatShanghaiDate(value as string | Date)
            : null
          : typeof value === "boolean"
            ? String(value)
            : (value as string | number | null),
        field,
        applied,
      );
    }),
  ),
);
function change(patch: Record<string, string>) {
  draft = { ...draft, ...patch };
}
function apply(event: SubmitEvent) {
  event.preventDefault();
  applied = { ...draft };
}
</script>

{#snippet actions(version: AdminBusVersion, compact = false)}
  <AdminBusVersionActions {copy} {enhancedAction} {onDelete} {pendingAction} {version} {compact} />
{/snippet}

{#snippet column(index: number, view: "desktop" | "mobile" = "desktop")}
  <TableFieldFilter label={index === 3 ? copy.colEffective : columns[index][0].label} fields={columns[index]} values={draft} onchange={change} labels={common.tableFilters} idPrefix={`admin-bus-${view}-${index}`} formId="admin-bus-filters" />
{/snippet}

<section class="grid min-w-0 gap-3">
  <form id="admin-bus-filters" onsubmit={apply} class="flex flex-wrap items-center gap-3">
    <Button type="submit">{common.applyFilters}</Button>
  </form>
  <ResponsiveCollection>
    {#snippet mobile()}
      <div class="flex flex-wrap gap-3" data-slot="collection-header">{#each columns as _, index}{@render column(index, "mobile")}{/each}</div>
      {#if visibleVersions.length === 0}
        <CollectionEmpty variant="compact" description={copy.noVersions} />
      {:else}
        <CollectionListShell>
          <Item.Group class="gap-0" data-testid="admin-bus-mobile-list">
            {#each visibleVersions as version, index (version.id)}
              <MobileListCard>
              <Item.Content class="min-w-0">
                <Item.Title title={version.title}>{version.title}</Item.Title>
                <Item.Description class="truncate font-mono" title={version.key}>{version.key}</Item.Description>
                {#if version.sourceMessage}
                  <Item.Description class="truncate" title={version.sourceMessage}>{version.sourceMessage}</Item.Description>
                {/if}
              </Item.Content>
              <Item.Actions>
                <AdminBusVersionStatusBadge {copy} {version} />
              </Item.Actions>
              <Item.Footer class="block">
                <dl class="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <dt class="text-muted-foreground text-xs">{copy.colTrips}</dt>
                    <dd class="text-muted-foreground tabular-nums">{version.tripCount}</dd>
                  </div>
                  <div>
                    <dt class="text-muted-foreground text-xs">{copy.colImported}</dt>
                    <dd class="tabular-nums">{dateTimeFormatter.format(new Date(version.importedAt))}</dd>
                  </div>
                  <div class="col-span-2">
                    <dt class="text-muted-foreground text-xs">{copy.colEffective}</dt>
                    <dd class="tabular-nums">
                      {formatBusVersionEffectiveRange(version)}
                    </dd>
                  </div>
                </dl>
                {#if !version.isEnabled}
                  <div class="mt-3 flex justify-end">
                    {@render actions(version, true)}
                  </div>
                {/if}
              </Item.Footer>
              </MobileListCard>
              {#if index < visibleVersions.length - 1}<Item.Separator class="my-0" />{/if}
            {/each}
          </Item.Group>
        </CollectionListShell>
      {/if}
    {/snippet}
    {#snippet desktop()}
      <div class="min-w-0">
        <CollectionTableShell label={copy.colTitle}>
          <Table.Root class="w-full min-w-[68rem]">
            <Table.Header>
              <Table.Row>
                <Table.Head class="w-[25%]">{@render column(0)}</Table.Head>
                <Table.Head class="w-[17%]">{@render column(1)}</Table.Head>
                <Table.Head class="w-[9%]">{@render column(2)}</Table.Head>
                <Table.Head class="w-[18%]">{@render column(3)}</Table.Head>
                <Table.Head class="w-[14%]">{@render column(4)}</Table.Head>
                <Table.Head class="w-[10%]">{@render column(5)}</Table.Head>
                <Table.Head class="w-20 min-w-20">
                  <span class="sr-only">{copy.colActions}</span>
                </Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {#each visibleVersions as version}
                <Table.Row class="group">
                  <Table.Cell class="max-w-0">
                    <span class="block max-w-full" title={version.title}>
                      <TruncatedText class="font-medium" text={version.title} />
                    </span>
                    <span class="block max-w-full" title={version.sourceMessage}>
                      <TruncatedText
                        class="text-muted-foreground text-xs"
                        text={version.sourceMessage}
                      />
                    </span>
                  </Table.Cell>
                  <Table.Cell class="max-w-0">
                    <span class="block max-w-full truncate font-mono text-sm" title={version.key}>
                      {version.key}
                    </span>
                  </Table.Cell>
                  <Table.Cell class="text-left tabular-nums">{version.tripCount}</Table.Cell>
                  <Table.Cell class="text-muted-foreground">
                    {formatBusVersionEffectiveRange(version)}
                  </Table.Cell>
                  <Table.Cell class="whitespace-nowrap text-left tabular-nums text-muted-foreground">
                    {dateTimeFormatter.format(new Date(version.importedAt))}
                  </Table.Cell>
                  <Table.Cell class="text-left">
                    <AdminBusVersionStatusBadge {copy} {version} />
                  </Table.Cell>
                  <Table.Cell class="w-20 min-w-20 text-left">
                    {@render actions(version)}
                  </Table.Cell>
                </Table.Row>
              {:else}
                <Table.Row>
                  <Table.Cell class="p-0" colspan={7}>
                    <CollectionEmpty variant="compact" description={copy.noVersions} />
                  </Table.Cell>
                </Table.Row>
              {/each}
            </Table.Body>
          </Table.Root>
        </CollectionTableShell>
      </div>
    {/snippet}
  </ResponsiveCollection>
</section>
