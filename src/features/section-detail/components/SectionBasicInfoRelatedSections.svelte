<script lang="ts">
import ClassIcon from "@lucide/svelte/icons/graduation-cap";
import GroupIcon from "@lucide/svelte/icons/layers";
import { sectionSummary } from "@/features/catalog/lib/catalog-list-display";
import { page as routePage } from "$app/state";
import type {
  SectionBasicInfo,
  SectionBasicInfoCopy,
} from "./section-basic-info-types";

interface Props {
  section: SectionBasicInfo;
  sectionCopy: SectionBasicInfoCopy;
}

let { section, sectionCopy }: Props = $props();

let locale = $derived(routePage.data.locale ?? "zh-cn");
</script>


{#if section.otherCourseSections.length > 0}
  <section class="grid gap-3">
    <h3 class="flex items-center gap-2 text-sm font-semibold tracking-tight">
      <GroupIcon aria-hidden="true" class="size-4 shrink-0 text-muted-foreground" />{sectionCopy.otherSections}
      {#if section.otherCourseSectionCount > section.otherCourseSections.length}
        <span class="text-muted-foreground font-normal">
          ({section.otherCourseSections.length}/{section.otherCourseSectionCount})
        </span>
      {/if}
    </h3>
    <ul class="grid gap-1.5 text-sm leading-relaxed">
      {#each section.otherCourseSections as related}
        <li class="min-w-0">
          <a
            class="text-foreground"
            href={`/catalog/sections/${related.jwId}`}
          >
            <ClassIcon aria-hidden="true" class="me-1 inline size-4 shrink-0 align-[-0.125em]" />{sectionSummary({ ...related, course: section.course }, locale)}
          </a>
        </li>
      {/each}
    </ul>
  </section>
{/if}
