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

<dl class="divide-y divide-base-300 border-base-300 border-y text-sm">
  <div class="grid gap-1 py-3 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-baseline">
    <dt class="text-base-content/60">{sectionCopy.sectionCode}</dt>
    <dd class="font-mono font-medium">{section.code}</dd>
  </div>
  <div class="grid gap-1 py-3 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-baseline">
    <dt class="text-base-content/60">{sectionCopy.semester}</dt>
    <dd class="font-medium">{section.semester?.nameCn ?? notAvailable}</dd>
  </div>
  <div class="grid gap-1 py-3 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-baseline">
    <dt class="text-base-content/60">{sectionCopy.credits}</dt>
    <dd class="font-medium">{section.credits ?? notAvailable}</dd>
  </div>
  <div class="grid gap-1 py-3 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-baseline">
    <dt class="text-base-content/60">{sectionCopy.period}</dt>
    <dd class="font-medium">
      {section.period ?? notAvailable} / {section.actualPeriods ?? notAvailable}
    </dd>
  </div>
  <div class="grid gap-1 py-3 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-baseline">
    <dt class="text-base-content/60">{sectionCopy.examMode}</dt>
    <dd class="font-medium">{primaryName(section.examMode) || notAvailable}</dd>
  </div>
  <div class="grid gap-1 py-3 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-baseline">
    <dt class="text-base-content/60">{sectionCopy.remark}</dt>
    <dd class="whitespace-pre-wrap font-medium">{section.remark ?? notAvailable}</dd>
  </div>
</dl>
