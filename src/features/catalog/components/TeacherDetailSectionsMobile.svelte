<script lang="ts">
import CollectionEmpty from "#lib/components/CollectionEmpty.svelte";
import MobileListCard from "#lib/components/MobileListCard.svelte";
import * as Item from "#lib/components/ui/item/index.js";
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
            <SectionCardIdentity course={section.course} teachers={[teacher]} code={section.code} semester={section.semester} {locale} />
            <Item.Footer class="flex-wrap justify-start">
              <span>{section.credits ?? notAvailable} {copy.teacherDetail.credits}</span>
            </Item.Footer>
          </a>
        {/snippet}
      </MobileListCard>
    {/each}
  </Item.Group>
{/if}
