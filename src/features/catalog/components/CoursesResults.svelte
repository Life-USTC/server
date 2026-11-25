<script lang="ts">
import CourseIcon from "@lucide/svelte/icons/book-open";
import EmptyState from "#lib/components/EmptyState.svelte";
import MobileListCard from "#lib/components/MobileListCard.svelte";
import ResponsiveCollection from "#lib/components/ResponsiveCollection.svelte";
import TruncatedCode from "#lib/components/TruncatedCode.svelte";
import TruncatedText from "#lib/components/TruncatedText.svelte";
import * as Item from "#lib/components/ui/item/index.js";
import Table from "#lib/components/ui/table/table.svelte";
import {
  type CatalogNamed,
  catalogLocalizedDisplayName,
} from "@/features/catalog/lib/catalog-list-display";
import { page as routePage } from "$app/state";
import CatalogColumnFilter from "./CatalogColumnFilter.svelte";
import CatalogEntityName from "./CatalogEntityName.svelte";
import CatalogMobileResults from "./CatalogMobileResults.svelte";
import CatalogTableLink from "./CatalogTableLink.svelte";
import type { CatalogColumnFilterProps } from "./catalog-column-filters";
import type {
  CourseListLabels,
  CourseListResultData,
} from "./catalog-course-list-types";

interface Props {
  columnFilters: Record<string, CatalogColumnFilterProps>;
  courseEmptyDescription: () => string;
  courseLabels: CourseListLabels;
  data: CourseListResultData;
  primaryName: (item: CatalogNamed | null | undefined) => string;
}

let {
  columnFilters,
  courseEmptyDescription,
  courseLabels,
  data,
  primaryName,
}: Props = $props();

let locale = $derived(routePage.data.locale ?? "zh-cn");
</script>


{#snippet empty()}
    <div class="py-10">
      <EmptyState variant="results"
        description={courseEmptyDescription()}
        title={courseLabels.noCoursesFound}
      />
    </div>
{/snippet}

<section class="grid min-w-0 gap-3">
    <ResponsiveCollection>
      {#snippet mobile()}
        <CatalogMobileResults rows={data.data} filters={columnFilters} prefix="mobile-course-" {empty}>
          {#snippet card(course)}
            {@const courseHref = `/catalog/courses/${course.jwId}`}
            <MobileListCard href={courseHref}>
              <Item.Content><Item.Title><CourseIcon aria-hidden="true" class="me-1 inline size-4 shrink-0 align-[-0.125em]" /><CatalogEntityName item={course} locale={locale} /></Item.Title></Item.Content>
              <Item.Actions><TruncatedCode text={course.code} /></Item.Actions>

              <Item.Footer class="flex-wrap justify-start">
                <span>{course.educationLevel ? primaryName(course.educationLevel) : "-"}</span>
                <span>{course.category ? primaryName(course.category) : "-"}</span>
                <span>{course.classType ? primaryName(course.classType) : "-"}</span>
              </Item.Footer>
            </MobileListCard>
          {/snippet}
        </CatalogMobileResults>
      {/snippet}
      {#snippet desktop()}
        <Table>
          <thead>
            <tr>
              <th class="pl-8"><CatalogColumnFilter {...columnFilters.name} idPrefix="desktop-course-name" /></th>
              <th><CatalogColumnFilter {...columnFilters.code} idPrefix="desktop-course-code" /></th>
              <th><CatalogColumnFilter {...columnFilters.educationLevel} idPrefix="desktop-course-educationLevel" /></th>
              <th><CatalogColumnFilter {...columnFilters.category} idPrefix="desktop-course-category" /></th>
              <th><CatalogColumnFilter {...columnFilters.classType} idPrefix="desktop-course-classType" /></th>
            </tr>
          </thead>
          <tbody>
            {#each data.data as course}
              {@const courseHref = `/catalog/courses/${course.jwId}`}
              <tr>
                <td class="p-0">
                  <CatalogTableLink class="font-medium" href={courseHref}>
                  <TruncatedText class="font-medium"
                      text={catalogLocalizedDisplayName(course, locale)}
                    >
                      {#snippet children()}
                        <CatalogEntityName item={course} locale={locale} />
                      {/snippet}
                    </TruncatedText>
                  </CatalogTableLink>
                </td>

                <td><TruncatedCode text={course.code} /></td>
                <td>{course.educationLevel ? primaryName(course.educationLevel) : "-"}</td>

                <td>
                  {course.category
                    ? catalogLocalizedDisplayName(course.category, locale)
                    : "-"}
                </td>
              <td>
                {course.classType ? primaryName(course.classType) : "-"}
              </td>
              </tr>
            {/each}
          {#if data.data.length === 0}
              <tr><td colspan={5}>{@render empty()}</td></tr>
            {/if}
          </tbody>
        </Table>
      {/snippet}
    </ResponsiveCollection>
</section>
