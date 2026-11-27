<script lang="ts">
import TeacherIcon from "@lucide/svelte/icons/user-round";
import MobileListCard from "#lib/components/MobileListCard.svelte";
import TruncatedText from "#lib/components/TruncatedText.svelte";
import * as Item from "#lib/components/ui/item/index.js";
import Table from "#lib/components/ui/table/table.svelte";
import {
  catalogLocalizedDisplayName,
  catalogPrimaryName as primaryName,
} from "@/features/catalog/lib/catalog-list-display";
import { page as routePage } from "$app/state";
import CatalogColumnFilter from "./CatalogColumnFilter.svelte";
import CatalogEntityName from "./CatalogEntityName.svelte";
import CatalogResults from "./CatalogResults.svelte";
import CatalogTableLink from "./CatalogTableLink.svelte";
import type { CatalogColumnFilterProps } from "./catalog-column-filters";
import type {
  TeacherListCommonLabels,
  TeacherListLabels,
  TeacherListRow,
} from "./catalog-teacher-list-types";

interface Props {
  commonLabels: TeacherListCommonLabels;
  columnFilters: Record<string, CatalogColumnFilterProps>;
  teacherLabels: TeacherListLabels;
  teachers: TeacherListRow[];
}

let { commonLabels, columnFilters, teacherLabels, teachers }: Props = $props();

let locale = $derived(routePage.data.locale ?? "zh-cn");
let showTitleColumn = $derived(Boolean(columnFilters.title));
let showEmailColumn = $derived(Boolean(columnFilters.email));

function teacherSectionsHref(teacher: TeacherListRow) {
  return `/catalog/teachers/${teacher.id}/sections`;
}
</script>

<CatalogResults rows={teachers} filters={columnFilters} prefix="mobile-teacher-" title={teacherLabels.noTeachersFound} description={teacherLabels.emptyDescription}>
  {#snippet card(teacher)}
    {@const teacherHref = `/catalog/teachers/${teacher.id}`}
    {@const sectionCount = teacher._count.sections}
    <MobileListCard href={teacherHref}>
      <Item.Content><Item.Title><TeacherIcon aria-hidden="true" class="me-1 inline size-4 shrink-0 align-[-0.125em]" /><CatalogEntityName item={teacher} locale={locale} /></Item.Title></Item.Content>
      <Item.Actions>
        {#if sectionCount > 0}
          <span
            class="invisible min-w-11 tabular-nums text-sm"
            aria-hidden="true"
          >{sectionCount}</span>
        {:else}
          <span class="tabular-nums text-muted-foreground text-sm" data-testid="teacher-section-count">0</span>
        {/if}
      </Item.Actions>

      <Item.Footer
        class="flex-wrap justify-start gap-x-3 gap-y-1 text-sm"
      >
        {#if teacher.code}
          <span class="font-mono text-muted-foreground">{teacher.code}</span>
        {/if}
      <span>{teacher.department ? primaryName(teacher.department) : teacherLabels.noDepartment}</span>
      {#if showTitleColumn}
        <span>{teacher.teacherTitle ? primaryName(teacher.teacherTitle) : commonLabels.unknown}</span>
      {/if}
        {#if showEmailColumn}
          <span>{teacher.email ?? "-"}</span>
        {/if}
      </Item.Footer>
    </MobileListCard>
    {#if sectionCount > 0}
      <a
        href={teacherSectionsHref(teacher)}
        class="absolute right-3 top-0 flex min-h-11 min-w-11 items-center justify-end text-sm tabular-nums text-muted-foreground underline-offset-2"
        data-testid="teacher-section-count"
      >{sectionCount}</a>
    {/if}
  {/snippet}
  {#snippet table(empty)}
    <Table class="">
      <thead>
        <tr>
          <th class="pl-8"><CatalogColumnFilter {...columnFilters.name} idPrefix="desktop-teacher-name" /></th>
          <th><CatalogColumnFilter {...columnFilters.code} idPrefix="desktop-teacher-code" /></th>
          <th><CatalogColumnFilter {...columnFilters.department} idPrefix="desktop-teacher-department" /></th>
          {#if showTitleColumn}
            <th><CatalogColumnFilter {...columnFilters.title} idPrefix="desktop-teacher-title" /></th>
          {/if}
          {#if showEmailColumn}
            <th><CatalogColumnFilter {...columnFilters.email} idPrefix="desktop-teacher-email" /></th>
          {/if}
          <th class="pl-8"><CatalogColumnFilter {...columnFilters.sections} idPrefix="desktop-teacher-sections" /></th>
        </tr>
      </thead>
      <tbody>
        {#each teachers as teacher}
          {@const teacherHref = `/catalog/teachers/${teacher.id}`}
          {@const sectionCount = teacher._count.sections}
          <tr>
            <td class="p-0">
              <CatalogTableLink class="font-medium" href={teacherHref}>
              <TruncatedText class="font-medium"
                  text={catalogLocalizedDisplayName(teacher, locale)}
                >
                  {#snippet children()}
                    <CatalogEntityName item={teacher} locale={locale} />
                  {/snippet}
                </TruncatedText>
              </CatalogTableLink>
            </td>
          <td class="whitespace-nowrap font-mono">
            {teacher.code || "-"}
          </td>
            <td>
              <TruncatedText
                text={teacher.department
                  ? primaryName(teacher.department)
                  : teacherLabels.noDepartment}
              />
            </td>
            {#if showTitleColumn}
              <td>
                {teacher.teacherTitle
                  ? primaryName(teacher.teacherTitle)
                  : commonLabels.unknown}
              </td>
            {/if}
          {#if showEmailColumn}
            <td>
              <TruncatedText text={teacher.email ?? "-"} />
            </td>
          {/if}
          <td class="p-0 whitespace-nowrap text-left tabular-nums">
            {#if sectionCount > 0}
              <CatalogTableLink
                class="tabular-nums"
                href={teacherSectionsHref(teacher)}
                numeric
              >
                <span data-testid="teacher-section-count">{sectionCount}</span>
              </CatalogTableLink>
            {:else}
              <span
                class="flex h-full min-h-12 min-w-0 w-full items-center pr-3 pl-8 tabular-nums"
                data-testid="teacher-section-count"
              >0</span>
            {/if}
          </td>
          </tr>
        {/each}
      {#if teachers.length === 0}
          <tr><td colspan={4 + Number(showTitleColumn) + Number(showEmailColumn)}>{@render empty()}</td></tr>
        {/if}
      </tbody>
    </Table>
  {/snippet}
</CatalogResults>
