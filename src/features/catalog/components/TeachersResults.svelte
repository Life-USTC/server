<script lang="ts">
import CollectionEmpty from "#lib/components/CollectionEmpty.svelte";
import RecordCollection from "#lib/components/RecordCollection.svelte";
import {
  type CatalogNamed,
  catalogLocalizedDisplayName,
} from "@/features/catalog/lib/catalog-list-display";
import { page as routePage } from "$app/state";
import CatalogEntityName from "./CatalogEntityName.svelte";
import type {
  TeacherListCommonLabels,
  TeacherListLabels,
  TeacherListRow,
} from "./catalog-teacher-list-types";

interface Props {
  filtered: boolean;
  clearLabel: string;
  commonLabels: TeacherListCommonLabels;
  primaryName: (item: CatalogNamed | null | undefined) => string;
  teacherLabels: TeacherListLabels;
  teachers: TeacherListRow[];
}

let {
  filtered,
  clearLabel,
  commonLabels,
  primaryName,
  teacherLabels,
  teachers,
}: Props = $props();

let locale = $derived(routePage.data.locale ?? "zh-cn");
/** Hide columns that are entirely empty or unknown on the current page. */
let showTitleColumn = $derived(
  teachers.some((teacher) => Boolean(teacher.teacherTitle)),
);
let showEmailColumn = $derived(
  teachers.some((teacher) => Boolean(teacher.email)),
);

function teacherSectionsHref(teacher: TeacherListRow) {
  return `/catalog/teachers/${teacher.id}#sections`;
}
</script>

{#snippet count(row: TeacherListRow)}
  {#if row._count.sections}<a href={teacherSectionsHref(row)} data-testid="teacher-section-count">{row._count.sections}</a>{:else}<span data-testid="teacher-section-count">0</span>{/if}
{/snippet}
{#if teachers.length}
  <RecordCollection secondaryLinks
    rows={teachers}
    href={row => `/catalog/teachers/${row.id}`}
    titleLabel={teacherLabels.name}
    titleText={row => catalogLocalizedDisplayName(row, locale)}
    code={row => row.code || "-"} codeLabel={teacherLabels.code}
    fields={[
      { label: teacherLabels.department, text: row => row.department ? primaryName(row.department) : teacherLabels.noDepartment },
      ...(showTitleColumn ? [{ label: teacherLabels.title_label, text: (row: TeacherListRow) => row.teacherTitle ? primaryName(row.teacherTitle) : commonLabels.unknown }] : []),
      ...(showEmailColumn ? [{ label: teacherLabels.email, text: (row: TeacherListRow) => row.email ?? "-" }] : []),
      { label: teacherLabels.sections, content: count }
    ]}
  >
    {#snippet title(row)}<CatalogEntityName item={row} {locale} />{/snippet}
  </RecordCollection>
{:else}
  <CollectionEmpty variant={filtered ? "filter-clear" : "browse"} clearHref="/catalog/teachers" clearFilterLabel={clearLabel} title={teacherLabels.noTeachersFound} description={teacherLabels.emptyDescription} />
{/if}
