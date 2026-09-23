<script lang="ts">
import {
  detailDefinitionListClass,
  detailDefinitionTermClass,
} from "$lib/components/detail-definition-list";
import type {
  SectionBasicInfo,
  SectionBasicInfoCopy,
  SectionCommonInfoCopy,
  SectionPrimaryName,
} from "./section-basic-info-types";

export let commonCopy: SectionCommonInfoCopy;
export let notAvailable: string;
export let periodDetailRows: Array<[string, number]>;
export let primaryName: SectionPrimaryName;
export let section: SectionBasicInfo;
export let sectionCopy: SectionBasicInfoCopy;
export let yesNo: (value: boolean | null | undefined) => string;
</script>

<section class="grid gap-3">
  <h3 class="text-sm font-semibold tracking-tight">{sectionCopy.moreDetails}</h3>
  <dl class={detailDefinitionListClass}>
    <dt class={detailDefinitionTermClass}>{sectionCopy.teachLanguage}</dt>
    <dd class="m-0 min-w-0">{primaryName(section.teachLanguage) || notAvailable}</dd>

    <dt class={detailDefinitionTermClass}>{sectionCopy.roomType}</dt>
    <dd class="m-0 min-w-0">{primaryName(section.roomType) || notAvailable}</dd>

    <dt class={detailDefinitionTermClass}>{commonCopy.undergraduateGraduate}</dt>
    <dd class="m-0 min-w-0">{yesNo(section.graduateAndPostgraduate)}</dd>

    <dt class={detailDefinitionTermClass}>{sectionCopy.periodsPerWeek}</dt>
    <dd class="m-0 min-w-0">
      {section.timesPerWeek ?? notAvailable} x {section.periodsPerWeek ?? notAvailable}
    </dd>

    {#each periodDetailRows as [label, value]}
      <dt class={detailDefinitionTermClass}>{label}</dt>
      <dd class="m-0 min-w-0">{value}</dd>
    {/each}

    <dt class={detailDefinitionTermClass}>{sectionCopy.department}</dt>
    <dd class="m-0 min-w-0">{primaryName(section.openDepartment) || notAvailable}</dd>
  </dl>
</section>
