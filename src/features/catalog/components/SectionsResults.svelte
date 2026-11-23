<script lang="ts">
import CollectionEmpty from "#lib/components/CollectionEmpty.svelte";
import RecordCollection from "#lib/components/RecordCollection.svelte";
import {
  type CatalogNamed,
  catalogLocalizedDisplayName,
  catalogLocalizedNames,
} from "@/features/catalog/lib/catalog-list-display";
import { formatSemesterName } from "@/lib/text/format-semester-name";
import { page as routePage } from "$app/state";
import CatalogEntityName from "./CatalogEntityName.svelte";
import type {
  SectionListLabels,
  SectionListRow,
} from "./catalog-section-list-types";

interface Props {
  filtered: boolean;
  clearLabel: string;
  rows: SectionListRow[];
  primaryName: (item: CatalogNamed | null | undefined) => string;
  sectionEmptyDescription: () => string;
  sectionLabels: SectionListLabels;
}

let {
  filtered,
  clearLabel,
  rows,
  primaryName,
  sectionEmptyDescription,
  sectionLabels,
}: Props = $props();

let locale = $derived(routePage.data.locale ?? "zh-cn");
</script>

{#if rows.length}
  <RecordCollection cardsTestId="catalog-results-cards"
    {rows}
    href={row => `/catalog/sections/${row.jwId}`}
    titleLabel={sectionLabels.courseName}
    titleText={row => catalogLocalizedDisplayName(row.course, locale)}
    code={row => row.code} codeLabel={sectionLabels.sectionCode}
    fields={[
      { label: sectionLabels.semester, text: row => row.semester?.nameCn ? formatSemesterName(locale, row.semester.nameCn) : sectionLabels.noSemester },
      { label: sectionLabels.teachers, text: row => catalogLocalizedNames(row.teachers, locale) || "-" },
      { label: sectionLabels.credits, text: row => row.credits ?? "-" },
      { label: sectionLabels.capacity, text: row => `${row.stdCount ?? (routePage.data.demo ? "-" : 0)} / ${row.limitCount ?? "-"}` },
      { label: sectionLabels.campus, text: row => row.campus ? primaryName(row.campus) : "-" }
    ]}
  >
    {#snippet title(row)}<CatalogEntityName item={row.course} {locale} />{/snippet}
  </RecordCollection>
{:else}
  <CollectionEmpty variant={filtered ? "filter-clear" : "browse"} clearHref="/catalog/sections" clearFilterLabel={clearLabel} title={sectionLabels.noSectionsFound} description={sectionEmptyDescription()} />
{/if}
