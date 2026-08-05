<script lang="ts">
import { catalogLocalizedDisplayName } from "@/features/catalog/lib/catalog-list-display";
import SoftEmptyMessage from "$lib/components/SoftEmptyMessage.svelte";
import TruncatedCode from "$lib/components/TruncatedCode.svelte";
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
    <SoftEmptyMessage message={copy.teacherDetail.noSections} />
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
