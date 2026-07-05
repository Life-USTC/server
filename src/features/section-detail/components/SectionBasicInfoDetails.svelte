<script lang="ts">
import * as Accordion from "$lib/components/ui/accordion/index.js";
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

<Accordion.Root type="single">
  <Accordion.Item value="more-details">
    <Accordion.Trigger>{sectionCopy.moreDetails}</Accordion.Trigger>
    <Accordion.Content>
      <dl class="grid gap-3 text-sm">
        <div class="flex items-baseline justify-between gap-4">
          <dt class="text-muted-foreground">{sectionCopy.teachLanguage}</dt>
          <dd>{primaryName(section.teachLanguage) || notAvailable}</dd>
        </div>
        <div class="flex items-baseline justify-between gap-4">
          <dt class="text-muted-foreground">{sectionCopy.roomType}</dt>
          <dd>{primaryName(section.roomType) || notAvailable}</dd>
        </div>
        <div class="flex items-baseline justify-between gap-4">
          <dt class="text-muted-foreground">{commonCopy.undergraduateGraduate}</dt>
          <dd>{yesNo(section.graduateAndPostgraduate)}</dd>
        </div>
        <div class="flex items-baseline justify-between gap-4">
          <dt class="text-muted-foreground">{sectionCopy.periodsPerWeek}</dt>
          <dd>
            {section.timesPerWeek ?? notAvailable} x {section.periodsPerWeek ?? notAvailable}
          </dd>
        </div>
        {#each periodDetailRows as [label, value]}
          <div class="flex items-baseline justify-between gap-4">
            <dt class="text-muted-foreground">{label}</dt>
            <dd>{value}</dd>
          </div>
        {/each}
        <div class="flex items-baseline justify-between gap-4">
          <dt class="text-muted-foreground">{sectionCopy.department}</dt>
          <dd>{primaryName(section.openDepartment) || notAvailable}</dd>
        </div>
      </dl>
    </Accordion.Content>
  </Accordion.Item>
</Accordion.Root>
