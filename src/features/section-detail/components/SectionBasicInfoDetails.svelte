<script lang="ts">
import type {
  SectionBasicInfo,
  SectionBasicInfoCopy,
  SectionCommonInfoCopy,
  SectionPrimaryName,
} from "./section-basic-info-types";

export let commonCopy: SectionCommonInfoCopy;
export let notAvailable: string;
export let primaryName: SectionPrimaryName;
export let section: SectionBasicInfo & { exams: Array<{ examMode?: string | null }> };
export let sectionCopy: SectionBasicInfoCopy;
export let yesNo: (value: boolean | null | undefined) => string;
export let periodDetailRows: Array<[string, number]>;
$: assessmentModes = [...new Set([
  primaryName(section.examMode),
  ...section.exams.map(exam => exam.examMode?.trim()),
].filter(Boolean))].join(" · ");
$: fields = [
  [sectionCopy.department, primaryName(section.openDepartment)],
  [sectionCopy.teachLanguage, primaryName(section.teachLanguage)],
  [commonCopy.undergraduateGraduate, yesNo(section.graduateAndPostgraduate)],
  [sectionCopy.totalPeriods, section.period],
  [sectionCopy.actualPeriods, section.actualPeriods],
  [sectionCopy.timesPerWeek, section.timesPerWeek],
  [sectionCopy.periodsPerWeek, section.periodsPerWeek],
  ...periodDetailRows,
  [sectionCopy.roomType, primaryName(section.roomType)],
  [sectionCopy.assessmentMode, assessmentModes],
];
</script>

<dl class="flex flex-wrap gap-x-6 gap-y-2 text-sm">
  {#each fields as [label, value]}
    {#if value != null && value !== "" && value !== notAvailable}
      <div class="flex items-baseline gap-2">
        <dt class="text-muted-foreground">{label}</dt><dd>{value}</dd>
      </div>
    {/if}
  {/each}
  {#if section.scheduleRemark?.trim()}
    <div class="flex w-full gap-2"><dt class="shrink-0 text-muted-foreground">{sectionCopy.scheduleRemark}</dt><dd class="whitespace-pre-wrap">{section.scheduleRemark}</dd></div>
  {/if}
</dl>
