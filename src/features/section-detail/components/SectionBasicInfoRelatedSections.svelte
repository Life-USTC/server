<script lang="ts">
import { formatSemesterName } from "@/lib/text/format-semester-name";
import { page } from "$app/stores";
import type {
  SectionBasicInfo,
  SectionBasicInfoCopy,
  SectionRelatedSummary,
  SectionTeachersLabel,
} from "./section-basic-info-types";

export let notAvailable: string;
export let section: SectionBasicInfo;
export let sectionCopy: SectionBasicInfoCopy;
export let sectionTeachersLabel: SectionTeachersLabel;

$: locale = $page.data.locale ?? "zh-cn";

function semesterLabel(related: SectionRelatedSummary) {
  return related.semester?.nameCn
    ? formatSemesterName(locale, related.semester.nameCn)
    : notAvailable;
}
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
            {semesterLabel(related)}
            <span class="text-muted-foreground">
              · {sectionTeachersLabel(related)}
            </span>
          </a>
        </li>
      {/each}
    </ul>
  </section>
{/if}
