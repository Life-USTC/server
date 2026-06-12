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

<dl class="grid gap-3 text-sm">
  <div class="rounded-md border border-base-300 bg-base-200/40 p-3">
    <dt class="text-base-content/60">{sectionCopy.sectionCode}</dt>
    <dd class="mt-1 font-mono font-medium">{section.code}</dd>
  </div>
  <div class="rounded-md border border-base-300 bg-base-200/40 p-3">
    <dt class="text-base-content/60">{sectionCopy.semester}</dt>
    <dd class="mt-1 font-medium">{section.semester?.nameCn ?? notAvailable}</dd>
  </div>
  <div class="rounded-md border border-base-300 bg-base-200/40 p-3">
    <dt class="text-base-content/60">{sectionCopy.credits}</dt>
    <dd class="mt-1 font-medium">{section.credits ?? notAvailable}</dd>
  </div>
  <div class="rounded-md border border-base-300 bg-base-200/40 p-3">
    <dt class="text-base-content/60">{sectionCopy.period}</dt>
    <dd class="mt-1 font-medium">
      {section.period ?? notAvailable} / {section.actualPeriods ?? notAvailable}
    </dd>
  </div>
  <div class="rounded-md border border-base-300 bg-base-200/40 p-3">
    <dt class="text-base-content/60">{sectionCopy.examMode}</dt>
    <dd class="mt-1 font-medium">{primaryName(section.examMode) || notAvailable}</dd>
  </div>
  <div class="rounded-md border border-base-300 bg-base-200/40 p-3">
    <dt class="text-base-content/60">{sectionCopy.remark}</dt>
    <dd class="mt-1 whitespace-pre-wrap font-medium">{section.remark ?? notAvailable}</dd>
  </div>
</dl>
