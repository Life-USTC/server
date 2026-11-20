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
export let section: SectionBasicInfo & {
  exams: Array<{ examMode?: string | null }>;
};
export let sectionCopy: SectionBasicInfoCopy;
export let yesNo: (value: boolean | null | undefined) => string;
export let periodDetailRows: Array<[string, number]>;
$: assessmentModes = [
  ...new Set(
    [
      primaryName(section.examMode),
      ...section.exams.map((exam) => exam.examMode?.trim()),
    ].filter(Boolean),
  ),
].join(" · ");
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

<dl class="grid grid-cols-1 gap-x-6 gap-y-2 text-sm @sm/detail:grid-cols-2 @3xl/detail:grid-cols-3">
  {#each fields as [label, value]}
    {#if value != null && value !== "" && value !== notAvailable}
      <div class="grid grid-cols-[7.5rem_minmax(0,1fr)] items-baseline gap-x-3">
        <dt class="text-muted-foreground">{label}</dt><dd>{value}</dd>
      </div>
    {/if}
  {/each}
  {#if section.scheduleRemark?.trim()}
    <div class="col-span-full grid grid-cols-[7.5rem_minmax(0,1fr)] items-baseline gap-x-3"><dt class="shrink-0 text-muted-foreground">{sectionCopy.scheduleRemark}</dt><dd class="whitespace-pre-wrap">{section.scheduleRemark}</dd></div>
  {/if}
</dl>
