<script lang="ts">
import CollectionEmpty from "#lib/components/CollectionEmpty.svelte";
import RecordCollection from "#lib/components/RecordCollection.svelte";
import { catalogLocalizedDisplayName } from "@/features/catalog/lib/catalog-list-display";
import { formatSemesterName } from "@/lib/text/format-semester-name";
import CatalogEntityName from "./CatalogEntityName.svelte";
import type {
  TeacherDetailCopy,
  TeacherDetailTeacher,
} from "./catalog-detail-component-types";

export let copy: TeacherDetailCopy;
export let locale: string;
export let notAvailable: string;
export let teacher: TeacherDetailTeacher;
</script>

<div class="min-w-0">
  {#if teacher.sections.length === 0}
    <CollectionEmpty variant="compact" description={copy.teacherDetail.noSections} />
  {:else}
    <RecordCollection
      rows={teacher.sections}
      href={row => `/catalog/sections/${row.jwId}`}
      titleLabel={copy.teacherDetail.courseName}
      titleText={row => catalogLocalizedDisplayName(row.course, locale)}
      code={row => row.code} codeLabel={copy.teacherDetail.sectionCode}
      fields={[
        { label: copy.teacherDetail.semester, text: row => row.semester?.nameCn ? formatSemesterName(locale, row.semester.nameCn) : notAvailable },
        { label: copy.teacherDetail.credits, text: row => row.credits ?? notAvailable }
      ]}
    >
      {#snippet title(row)}<CatalogEntityName item={row.course} {locale} />{/snippet}
    </RecordCollection>
  {/if}
</div>
