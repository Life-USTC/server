<script lang="ts">
import CollectionEmpty from "#lib/components/CollectionEmpty.svelte";
import MobileListCard from "#lib/components/MobileListCard.svelte";
import TruncatedCode from "#lib/components/TruncatedCode.svelte";
import * as Item from "#lib/components/ui/item/index.js";
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

{#if teacher.sections.length === 0}
  <div class="min-w-0">
    <CollectionEmpty variant="compact" description={copy.teacherDetail.noSections} />
  </div>
{:else}
  <Item.Group class="min-w-0">
    {#each teacher.sections as section}
      <MobileListCard variant="outline" size="sm">
        {#snippet child({ props })}
          <a href={`/catalog/sections/${section.jwId}`} {...props}>
            <Item.Content>
              <Item.Title><CatalogEntityName item={section.course} {locale} /></Item.Title>
            </Item.Content>
            <Item.Actions>
              <TruncatedCode text={section.code} />
            </Item.Actions>
            <Item.Footer class="flex-wrap justify-start">
              <span>{section.semester?.nameCn ? formatSemesterName(locale, section.semester.nameCn) : notAvailable}</span>
              <span>{section.credits ?? notAvailable} {copy.teacherDetail.credits}</span>
            </Item.Footer>
          </a>
        {/snippet}
      </MobileListCard>
    {/each}
  </Item.Group>
{/if}
