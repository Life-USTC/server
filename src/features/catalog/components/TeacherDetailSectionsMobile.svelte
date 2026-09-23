<script lang="ts">
import { catalogLocalizedDisplayName } from "@/features/catalog/lib/catalog-list-display";
import TruncatedCode from "$lib/components/TruncatedCode.svelte";
import * as Empty from "$lib/components/ui/empty/index.js";
import * as Item from "$lib/components/ui/item/index.js";
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
  <div class="md:hidden">
    <Empty.Root class="min-h-20 border-0 px-2 py-6">
      <Empty.Header>
        <Empty.Description>{copy.teacherDetail.noSections}</Empty.Description>
      </Empty.Header>
    </Empty.Root>
  </div>
{:else}
  <Item.Group class="md:hidden">
    {#each teacher.sections as section}
      <Item.Root variant="outline" size="sm">
        {#snippet child({ props })}
          <a href={`/catalog/sections/${section.jwId}`} {...props}>
            <Item.Content>
              <Item.Title>{catalogLocalizedDisplayName(section.course, locale)}</Item.Title>
            </Item.Content>
            <Item.Actions>
              <TruncatedCode text={section.code} />
            </Item.Actions>
            <Item.Footer class="flex-wrap justify-start">
              <span>{section.semester?.nameCn ?? notAvailable}</span>
              <span>{section.credits ?? notAvailable} {copy.teacherDetail.credits}</span>
            </Item.Footer>
          </a>
        {/snippet}
      </Item.Root>
    {/each}
  </Item.Group>
{/if}
