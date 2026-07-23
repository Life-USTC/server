<script lang="ts">
import type { CatalogNamed } from "@/features/catalog/lib/catalog-list-display";
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
export let notAvailable: string;
export let primaryName: (item: CatalogNamed | null | undefined) => string;
export let secondaryName: (item: CatalogNamed | null | undefined) => string;
export let teacher: TeacherDetailTeacher;
</script>

<div class="hidden md:block">
  <Table.Root class="table-fixed">
    <Table.Header>
      <Table.Row>
        <Table.Head class="w-32">{copy.teacherDetail.semester}</Table.Head>
        <Table.Head>{copy.teacherDetail.courseName}</Table.Head>
        <Table.Head class="w-28">{copy.teacherDetail.sectionCode}</Table.Head>
        <Table.Head class="w-16 text-right">{copy.teacherDetail.credits}</Table.Head>
      </Table.Row>
    </Table.Header>
    <Table.Body>
      {#each teacher.sections as section}
        {@const sectionHref = `/catalog/sections/${section.jwId}`}
        <Table.Row>
          <Table.Cell class="p-0 align-top">
            <CatalogTableLink href={sectionHref} nowrap>
              <TruncatedText
                class={!section.semester ? "text-muted-foreground" : ""}
                text={section.semester?.nameCn ?? notAvailable}
              />
            </CatalogTableLink>
          </Table.Cell>
          <Table.Cell class="min-w-72 p-0 align-top">
            <CatalogTableLink href={sectionHref}>
              <TruncatedText
                class="font-medium"
                text={primaryName(section.course)}
              />
              <TruncatedText
                class="text-muted-foreground text-xs"
                text={secondaryName(section.course)}
              />
            </CatalogTableLink>
          </Table.Cell>
          <Table.Cell class="p-0 align-top">
            <CatalogTableLink href={sectionHref}>
              <TruncatedCode text={section.code} />
            </CatalogTableLink>
          </Table.Cell>
          <Table.Cell class="p-0 text-right align-top">
            <CatalogTableLink href={sectionHref} numeric>
              {section.credits ?? notAvailable}
            </CatalogTableLink>
          </Table.Cell>
        </Table.Row>
      {:else}
        <Table.Row>
          <Table.Cell class="p-0" colspan={4}>
            <Empty.Root class="py-6">
              <Empty.Header>
                <Empty.Title>{copy.teacherDetail.noSections}</Empty.Title>
              </Empty.Header>
            </Empty.Root>
          </Table.Cell>
        </Table.Row>
      {/each}
    </Table.Body>
  </Table.Root>
</div>
