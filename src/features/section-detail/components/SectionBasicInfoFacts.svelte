<script lang="ts">
import type {
  SectionBasicInfo,
  SectionBasicInfoCopy,
  SectionPrimaryName,
} from "./section-basic-info-types";

export let notAvailable: string;
export let primaryName: SectionPrimaryName;
export let section: SectionBasicInfo;
export let sectionCopy: SectionBasicInfoCopy;
</script>

<dl class="grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2 xl:grid-cols-3">
  <div class="min-w-0 py-1.5 sm:min-h-14">
    <dt class="text-base-content/60 text-xs">{sectionCopy.sectionCode}</dt>
    <dd class="mt-1 font-mono font-medium">{section.code}</dd>
  </div>
  <div class="min-w-0 py-1.5 sm:min-h-14">
    <dt class="text-base-content/60 text-xs">{sectionCopy.semester}</dt>
    <dd class="mt-1 font-medium">{section.semester?.nameCn ?? notAvailable}</dd>
  </div>
  <div class="min-w-0 py-1.5 sm:min-h-14">
    <dt class="text-base-content/60 text-xs">{sectionCopy.credits}</dt>
    <dd class="mt-1 font-medium">{section.credits ?? notAvailable}</dd>
  </div>
  <div class="min-w-0 py-1.5 sm:min-h-14">
    <dt class="text-base-content/60 text-xs">{sectionCopy.period}</dt>
    <dd class="mt-1 font-medium">
      {section.period ?? notAvailable} / {section.actualPeriods ?? notAvailable}
    </dd>
  </div>
  <div class="min-w-0 py-1.5 sm:min-h-14">
    <dt class="text-base-content/60 text-xs">{sectionCopy.examMode}</dt>
    <dd class="mt-1 font-medium">{primaryName(section.examMode) || notAvailable}</dd>
  </div>
  <div class="min-w-0 py-1.5 sm:col-span-2 sm:min-h-14 xl:col-span-3">
    <dt class="text-base-content/60 text-xs">{sectionCopy.remark}</dt>
    <dd class="mt-1 whitespace-pre-wrap font-medium">{section.remark ?? notAvailable}</dd>
  </div>
</dl>
