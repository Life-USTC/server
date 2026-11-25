<script lang="ts">
import CollectionEmpty from "#lib/components/CollectionEmpty.svelte";
import MobileListCard from "#lib/components/MobileListCard.svelte";
import ResponsiveCollection from "#lib/components/ResponsiveCollection.svelte";
import TruncatedCode from "#lib/components/TruncatedCode.svelte";
import * as Item from "#lib/components/ui/item/index.js";
import Table from "#lib/components/ui/table/table.svelte";
import { catalogPrimaryName } from "@/features/catalog/lib/catalog-list-display";
import { formatSemesterName } from "@/lib/text/format-semester-name";
import CatalogTableLink from "./CatalogTableLink.svelte";
import type {
  TeacherDetailCopy,
  TeacherDetailTeacher,
} from "./catalog-detail-component-types";
import SectionCardIdentity from "./SectionCardIdentity.svelte";

export let copy: TeacherDetailCopy;
export let locale: string;
export let notAvailable: string;
export let teacher: TeacherDetailTeacher;
</script>

<section class="grid gap-4">
  {#if teacher.sections.length === 0}
    <div class="min-w-0">
      <CollectionEmpty variant="compact" description={copy.teacherDetail.noSections} />
    </div>
  {:else}
    <ResponsiveCollection>
      {#snippet mobile()}
        <Item.Group class="min-w-0">
          {#each teacher.sections as section}
            <MobileListCard variant="outline" href={`/catalog/sections/${section.jwId}`}>
              <SectionCardIdentity course={section.course} teachers={section.teachers ?? [teacher]} code={section.code} semester={section.semester} {locale} />
              <Item.Footer class="flex-wrap justify-start">
                <span>{section.credits ?? notAvailable} {copy.teacherDetail.credits}</span>
              </Item.Footer>
            </MobileListCard>
          {/each}
        </Item.Group>
      {/snippet}
      {#snippet desktop()}
        <div class="min-w-0">
          <Table>
            <thead>
              <tr>
                <th>{copy.teacherDetail.semester}</th>
                <th>{copy.teacherDetail.sectionCode}</th>
                <th>{copy.teacherDetail.credits}</th>
                <th class="pl-8">{copy.teacherDetail.courseName}</th>
              </tr>
            </thead>
            <tbody>
              {#each teacher.sections as section}
                {@const sectionHref = `/catalog/sections/${section.jwId}`}
                <tr>
                  <td>{section.semester?.nameCn ? formatSemesterName(locale, section.semester.nameCn) : notAvailable}</td>
                  <td><TruncatedCode text={section.code} /></td>
                  <td>{section.credits ?? notAvailable}</td>
                  <td class="p-0">
                    <CatalogTableLink class="font-medium" href={sectionHref}>
                      <span class="break-words">{catalogPrimaryName(section.course) || notAvailable}</span>
                    </CatalogTableLink>
                  </td>
                </tr>
              {/each}
            </tbody>
          </Table>
        </div>
      {/snippet}
    </ResponsiveCollection>
  {/if}
</section>
