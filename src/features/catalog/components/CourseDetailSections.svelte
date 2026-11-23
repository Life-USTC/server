<script lang="ts">
import CollectionEmpty from "#lib/components/CollectionEmpty.svelte";
import RecordCollection from "#lib/components/RecordCollection.svelte";
import {
  type CatalogNamed,
  catalogLocalizedNames,
} from "@/features/catalog/lib/catalog-list-display";
import { formatSemesterName } from "@/lib/text/format-semester-name";
import type {
  CourseDetailCopy,
  CourseDetailCourse,
} from "./catalog-detail-component-types";

export let copy: CourseDetailCopy;
export let course: CourseDetailCourse;
export let locale: string;
export let notAvailable: string;
export let primaryName: (item: CatalogNamed | null | undefined) => string;
</script>

<div class="min-w-0">
  {#if course.sections.length === 0}
    <CollectionEmpty variant="compact"
      title={copy.courseDetail.noSections}
      description={copy.courseDetail.emptySectionsDescription}
    />
  {:else}
    <RecordCollection
      rows={course.sections}
      href={row => `/catalog/sections/${row.jwId}`}
      titleLabel={copy.courseDetail.semester}
      titleText={row => row.semester?.nameCn ? formatSemesterName(locale, row.semester.nameCn) : notAvailable}
      code={row => row.code} codeLabel={copy.courseDetail.sectionCode}
      fields={[
        { label: copy.courseDetail.campus, text: row => primaryName(row.campus) || notAvailable },
        { label: copy.courseDetail.capacity, text: row => `${row.stdCount ?? 0} / ${row.limitCount ?? notAvailable}` },
        { label: copy.courseDetail.teachers, text: row => catalogLocalizedNames(row.teachers, locale) || notAvailable }
      ]}
    />
  {/if}
</div>
