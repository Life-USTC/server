<script lang="ts">
import SectionBasicInfoAdminClasses from "./SectionBasicInfoAdminClasses.svelte";
import SectionBasicInfoFacts from "./SectionBasicInfoFacts.svelte";
import SectionBasicInfoRelatedSections from "./SectionBasicInfoRelatedSections.svelte";
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

<div class="grid gap-4">
  <SectionBasicInfoFacts
    {notAvailable}
    {section}
    {sectionCopy}
  />

  <SectionBasicInfoAdminClasses
    {primaryName}
    {section}
    {sectionCopy}
  />

  <SectionBasicInfoRelatedSections
    {section}
    {sectionCopy}
  />
</div>
