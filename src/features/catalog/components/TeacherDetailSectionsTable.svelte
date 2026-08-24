<script lang="ts">
import { catalogLocalizedDisplayName } from "@/features/catalog/lib/catalog-list-display";
import TruncatedCode from "$lib/components/TruncatedCode.svelte";
import TruncatedText from "$lib/components/TruncatedText.svelte";
import * as Empty from "$lib/components/ui/empty/index.js";
import * as Table from "$lib/components/ui/table/index.js";
import CatalogTableLink from "./CatalogTableLink.svelte";
import type {
  TeacherDetailCopy,
  TeacherDetailTeacher,
} from "./catalog-detail-component-types";

export let copy: TeacherDetailCopy;
export let locale: string;
export let notAvailable: string;
export let teacher: TeacherDetailTeacher;
</script>

<div class="hidden md:block">
  {#if teacher.sections.length === 0}
    <Empty.Root class="min-h-20 border-0 px-2 py-6">
      <Empty.Header>
        <Empty.Description>{copy.teacherDetail.noSections}</Empty.Description>
      </Empty.Header>
    </Empty.Root>
  {:else}
    <Table.Root class="">
      <Table.Header>
        <Table.Row>
          <Table.Head>{copy.teacherDetail.semester}</Table.Head>
          <Table.Head>{copy.teacherDetail.sectionCode}</Table.Head>
          <Table.Head>{copy.teacherDetail.credits}</Table.Head>
          <Table.Head>{copy.teacherDetail.courseName}</Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#each teacher.sections as section}
          {@const sectionHref = `/catalog/sections/${section.jwId}`}
          <Table.Row>
            <Table.Cell class="p-0">
              <CatalogTableLink href={sectionHref} nowrap>
                {section.semester?.nameCn ?? notAvailable}
              </CatalogTableLink>
            </Table.Cell>
            <Table.Cell class="p-0">
              <CatalogTableLink href={sectionHref}>
                <TruncatedCode text={section.code} />
              </CatalogTableLink>
            </Table.Cell>
            <Table.Cell class="p-0">
              <CatalogTableLink href={sectionHref} numeric>
                {section.credits ?? notAvailable}
              </CatalogTableLink>
            </Table.Cell>
            <Table.Cell class="p-0">
              <CatalogTableLink href={sectionHref}>
                <TruncatedText
                  text={catalogLocalizedDisplayName(section.course, locale)}
                />
              </CatalogTableLink>
            </Table.Cell>
          </Table.Row>
        {/each}
      </Table.Body>
    </Table.Root>
  {/if}
</div>
