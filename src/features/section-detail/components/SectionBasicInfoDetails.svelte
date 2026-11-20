<script lang="ts">
import {
  detailDefinitionListClass,
  detailDefinitionTermClass,
} from "#lib/components/detail-definition-list.js";
import type {
  SectionBasicInfo,
  SectionBasicInfoCopy,
  SectionCommonInfoCopy,
  SectionPrimaryName,
} from "./section-basic-info-types";

export let commonCopy: SectionCommonInfoCopy;
export let notAvailable: string;
export let primaryName: SectionPrimaryName;
export let section: SectionBasicInfo;
export let sectionCopy: SectionBasicInfoCopy;
export let yesNo: (value: boolean | null | undefined) => string;
</script>

<dl class={detailDefinitionListClass}>
  <dt class={detailDefinitionTermClass}>{sectionCopy.teachLanguage}</dt>
  <dd class="m-0 min-w-0">{primaryName(section.teachLanguage) || notAvailable}</dd>

  <dt class={detailDefinitionTermClass}>{commonCopy.undergraduateGraduate}</dt>
  <dd class="m-0 min-w-0">{yesNo(section.graduateAndPostgraduate)}</dd>

  <dt class={detailDefinitionTermClass}>{sectionCopy.department}</dt>
  <dd class="m-0 min-w-0">{primaryName(section.openDepartment) || notAvailable}</dd>
</dl>
