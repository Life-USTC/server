<script lang="ts">
import TruncatedCode from "#lib/components/TruncatedCode.svelte";
import * as Item from "#lib/components/ui/item/index.js";
import Table from "#lib/components/ui/table/table.svelte";
import { catalogPrimaryName } from "@/features/catalog/lib/catalog-list-display";
import { formatSemesterName } from "@/lib/text/format-semester-name";
import CatalogSectionHistory from "./CatalogSectionHistory.svelte";
import CatalogTableLink from "./CatalogTableLink.svelte";
import type { TeacherPage } from "./catalog-detail-component-types";
import SectionCardIdentity from "./SectionCardIdentity.svelte";

export let data: TeacherPage;
$: ({ teacher, copy, locale } = data);
$: notAvailable = copy.teacherDetail.notAvailable;
</script>

<CatalogSectionHistory {data} rows={(value) => value.teacher.sections}
  title={copy.teacherDetail.teachingSectionsTitle} description={copy.teacherDetail.teachingSectionsDescription}
  labels={copy.common.endlessScroll} emptyDescription={copy.teacherDetail.noSections}>
  {#snippet card(section)}
    <SectionCardIdentity course={section.course} teachers={section.teachers ?? [teacher]} code={section.code} semester={section.semester} {locale} />
    <Item.Footer class="flex-wrap justify-start">
      <span>{section.credits ?? notAvailable} {copy.teacherDetail.credits}</span>
    </Item.Footer>
  {/snippet}
  {#snippet table(sections, href)}
    <Table>
      <thead><tr>
        <th>{copy.teacherDetail.semester}</th>
        <th>{copy.teacherDetail.sectionCode}</th>
        <th>{copy.teacherDetail.credits}</th>
        <th class="pl-8">{copy.teacherDetail.courseName}</th>
      </tr></thead>
      <tbody>
        {#each sections as section}
          <tr>
            <td>{section.semester?.nameCn ? formatSemesterName(locale, section.semester.nameCn) : notAvailable}</td>
            <td><TruncatedCode text={section.code} /></td>
            <td>{section.credits ?? notAvailable}</td>
            <td class="p-0">
              <CatalogTableLink class="font-medium" href={href(section)}>
                <span class="break-words">{catalogPrimaryName(section.course) || notAvailable}</span>
              </CatalogTableLink>
            </td>
          </tr>
        {/each}
      </tbody>
    </Table>
  {/snippet}
</CatalogSectionHistory>
