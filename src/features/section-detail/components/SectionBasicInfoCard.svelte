<script lang="ts">
import { Button } from "$lib/components/ui/button/index.js";
import * as Card from "$lib/components/ui/card/index.js";
import SectionBasicInfoAdminClasses from "./SectionBasicInfoAdminClasses.svelte";
import SectionBasicInfoDetails from "./SectionBasicInfoDetails.svelte";
import SectionBasicInfoFacts from "./SectionBasicInfoFacts.svelte";
import SectionBasicInfoRelatedSections from "./SectionBasicInfoRelatedSections.svelte";
import type {
  SectionBasicInfo,
  SectionBasicInfoCopy,
  SectionCommonInfoCopy,
  SectionPrimaryName,
  SectionTeachersLabel,
} from "./section-basic-info-types";

export let commonCopy: SectionCommonInfoCopy;
export let notAvailable: string;
export let periodDetailRows: Array<[string, number]>;
export let primaryName: SectionPrimaryName;
export let section: SectionBasicInfo;
export let sectionCopy: SectionBasicInfoCopy;
export let sectionTeachersLabel: SectionTeachersLabel;
export let yesNo: (value: boolean | null | undefined) => string;
</script>

<Card.Root>
  <Card.Header>
    <Card.Title>{sectionCopy.basicInfo}</Card.Title>
    <Card.Description>{sectionCopy.basicInfoDescription}</Card.Description>
  </Card.Header>
  <Card.Content class="grid gap-4">
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

    <Button class="h-auto w-fit text-sm" href={`/courses/${section.course.jwId}`} variant="link">
      {sectionCopy.viewAllCourseSections}
    </Button>
  </Card.Content>
</Card.Root>
