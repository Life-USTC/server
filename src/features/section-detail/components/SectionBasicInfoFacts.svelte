<script lang="ts">
import { formatSemesterName } from "@/lib/text/format-semester-name";
import { page } from "$app/stores";
import {
  detailDefinitionListClass,
  detailDefinitionTermClass,
} from "$lib/components/detail-definition-list";
import type {
  SectionBasicInfo,
  SectionBasicInfoCopy,
  SectionPrimaryName,
} from "./section-basic-info-types";

export let notAvailable: string;
export let primaryName: SectionPrimaryName;
export let section: SectionBasicInfo;
export let sectionCopy: SectionBasicInfoCopy;

$: locale = $page.data.locale ?? "zh-cn";
$: capacityValue =
  section.stdCount != null || section.limitCount != null
    ? `${section.stdCount ?? 0} / ${section.limitCount ?? notAvailable}`
    : notAvailable;
$: remarkValue = section.remark?.trim() || notAvailable;
$: scheduleRemarkValue = section.scheduleRemark?.trim() || null;
</script>

<dl class={detailDefinitionListClass}>
  <dt class={detailDefinitionTermClass}>{sectionCopy.sectionCode}</dt>
  <dd class="m-0 font-mono text-muted-foreground">{section.code}</dd>

  <dt class={detailDefinitionTermClass}>{sectionCopy.semester}</dt>
  <dd class="m-0 min-w-0 font-medium">
    {section.semester?.nameCn
      ? formatSemesterName(locale, section.semester.nameCn)
      : notAvailable}
  </dd>

  <dt class={detailDefinitionTermClass}>{sectionCopy.campus}</dt>
  <dd class="m-0 min-w-0 font-medium">{primaryName(section.campus) || notAvailable}</dd>

  <dt class={detailDefinitionTermClass}>{sectionCopy.credits}</dt>
  <dd class="m-0 min-w-0 font-medium">{section.credits ?? notAvailable}</dd>

  <dt class={detailDefinitionTermClass}>{sectionCopy.summaryCapacityMeta}</dt>
  <dd class="m-0 min-w-0 font-medium">{capacityValue}</dd>

  <dt class={detailDefinitionTermClass}>{sectionCopy.period}</dt>
  <dd class="m-0 min-w-0 font-medium">
    {section.period ?? notAvailable} / {section.actualPeriods ?? notAvailable}
  </dd>

  <dt class={detailDefinitionTermClass}>{sectionCopy.examMode}</dt>
  <dd class="m-0 min-w-0 font-medium">{primaryName(section.examMode) || notAvailable}</dd>

  <dt class={detailDefinitionTermClass}>{sectionCopy.remark}</dt>
  <dd class="m-0 min-w-0 whitespace-pre-wrap font-medium">{remarkValue}</dd>

  {#if scheduleRemarkValue}
    <dt class={detailDefinitionTermClass}>{sectionCopy.scheduleRemark}</dt>
    <dd class="m-0 min-w-0 whitespace-pre-wrap font-medium">{scheduleRemarkValue}</dd>
  {/if}
</dl>
