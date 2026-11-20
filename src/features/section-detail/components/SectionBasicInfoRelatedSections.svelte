<script lang="ts">
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
    <h3 class="text-sm font-semibold tracking-tight">
      {sectionCopy.otherSections}
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
            class="text-foreground hover:underline"
            href={`/catalog/sections/${related.jwId}`}
          >
            {sectionSummary({ ...related, course: section.course }, locale)}
          </a>
        </li>
      {/each}
    </ul>
  </section>
{/if}
