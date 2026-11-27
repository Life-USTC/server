<script lang="ts">
import TruncatedCode from "#lib/components/TruncatedCode.svelte";
import TruncatedText from "#lib/components/TruncatedText.svelte";
import * as Item from "#lib/components/ui/item/index.js";
import Table from "#lib/components/ui/table/table.svelte";
import {
  catalogLocalizedNames,
  catalogPrimaryName as primaryName,
  sectionSummary,
} from "@/features/catalog/lib/catalog-list-display";
import CatalogSectionHistory from "./CatalogSectionHistory.svelte";
import CatalogTableLink from "./CatalogTableLink.svelte";
import type { CoursePage } from "./catalog-detail-component-types";
import SectionCardIdentity from "./SectionCardIdentity.svelte";

export let data: CoursePage;
$: ({ course, copy, locale } = data);
$: notAvailable = copy.courseDetail.notAvailable;
</script>

<CatalogSectionHistory {data} rows={(value) => value.course.sections}
  title={copy.courseDetail.teachingSections} description={copy.courseDetail.teachingSectionsDescription}
  labels={copy.common.endlessScroll} emptyTitle={copy.courseDetail.noSections} emptyDescription={copy.courseDetail.emptySectionsDescription}>
  {#snippet card(section)}
    <SectionCardIdentity {course} teachers={section.teachers} code={section.code} semester={section.semester} {locale} />
    <Item.Footer class="flex-wrap justify-start">
      <span>{copy.courseDetail.campus}: {primaryName(section.campus) || notAvailable}</span>
      <span>{copy.courseDetail.capacity}: {section.stdCount ?? 0} / {section.limitCount ?? notAvailable}</span>
    </Item.Footer>
  {/snippet}
  {#snippet table(sections, href)}
    <Table>
      <thead><tr>
        <th class="pl-8">{copy.courseDetail.teachingSections}</th>
        <th>{copy.courseDetail.sectionCode}</th>
        <th>{copy.courseDetail.campus}</th>
        <th>{copy.courseDetail.capacity}</th>
        <th>{copy.courseDetail.teachers}</th>
      </tr></thead>
      <tbody>
        {#each sections as section}
          <tr>
            <td class="p-0">
              <CatalogTableLink class="font-medium" href={href(section)}>
                {sectionSummary({ ...section, course }, locale)}
              </CatalogTableLink>
            </td>
            <td><TruncatedCode text={section.code} /></td>
            <td>{primaryName(section.campus) || notAvailable}</td>
            <td>{section.stdCount ?? 0} / {section.limitCount ?? notAvailable}</td>
            <td><TruncatedText
                  text={catalogLocalizedNames(section.teachers, locale) || notAvailable}
                /></td>
          </tr>
        {/each}
      </tbody>
    </Table>
  {/snippet}
</CatalogSectionHistory>
