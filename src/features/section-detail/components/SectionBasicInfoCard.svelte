<script lang="ts">
import SectionBasicInfoAdminClasses from "./SectionBasicInfoAdminClasses.svelte";
import SectionBasicInfoDetails from "./SectionBasicInfoDetails.svelte";
import SectionBasicInfoFacts from "./SectionBasicInfoFacts.svelte";
import SectionBasicInfoRelatedSections from "./SectionBasicInfoRelatedSections.svelte";
import SectionTeachersCard from "./SectionTeachersCard.svelte";
import type {
  SectionBasicInfo,
  SectionBasicInfoCopy,
  SectionCommonInfoCopy,
  SectionPrimaryName,
  SectionTeacherCopy,
  SectionTeacherName,
  SectionTeacherSummary,
  SectionTeachersLabel,
} from "./section-basic-info-types";

export let commonCopy: SectionCommonInfoCopy;
export let notAvailable: string;
export let periodDetailRows: Array<[string, number]>;
export let primaryName: SectionPrimaryName;
export let section: SectionBasicInfo;
export let sectionCopy: SectionBasicInfoCopy & SectionTeacherCopy;
export let sectionTeachersLabel: SectionTeachersLabel;
export let teacherName: SectionTeacherName;
export let teachers: SectionTeacherSummary[];
export let yesNo: (value: boolean | null | undefined) => string;
</script>

<div class="grid gap-10">
  <SectionBasicInfoFacts
    {notAvailable}
    {primaryName}
    {section}
    {sectionCopy}
  />

  <SectionBasicInfoDetails
    {commonCopy}
    {notAvailable}
    {periodDetailRows}
    {primaryName}
    {section}
    {sectionCopy}
    {yesNo}
  />

  <SectionTeachersCard
    {primaryName}
    {sectionCopy}
    {teacherName}
    {teachers}
  />

  <SectionBasicInfoAdminClasses
    {primaryName}
    {section}
    {sectionCopy}
  />

  <SectionBasicInfoRelatedSections
    {notAvailable}
    {section}
    {sectionCopy}
    {sectionTeachersLabel}
  />
</div>
