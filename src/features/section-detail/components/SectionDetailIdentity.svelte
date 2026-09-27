<script lang="ts">
import { formatSemesterName } from "@/lib/text/format-semester-name";
import { page } from "$app/stores";
import {
  detailDefinitionListClass,
  detailDefinitionTermClass,
} from "$lib/components/detail-definition-list";
import SectionTeachersCard from "./SectionTeachersCard.svelte";
import type {
  SectionBasicInfo,
  SectionBasicInfoCopy,
  SectionPrimaryName,
  SectionTeacherCopy,
  SectionTeacherName,
  SectionTeacherSummary,
} from "./section-basic-info-types";

export let notAvailable: string;
export let primaryName: SectionPrimaryName;
export let section: SectionBasicInfo;
export let sectionCopy: SectionBasicInfoCopy & SectionTeacherCopy;
export let teacherName: SectionTeacherName;
export let teachers: SectionTeacherSummary[];
$: locale = $page.data.locale ?? "zh-cn";
</script>

<div class="grid gap-4">
  <SectionTeachersCard {primaryName} {sectionCopy} {teacherName} {teachers} />
  <dl class={detailDefinitionListClass}>
  <dt class={detailDefinitionTermClass}>{sectionCopy.semester}</dt>
  <dd class="m-0 min-w-0 font-medium">
    {section.semester?.nameCn
      ? formatSemesterName(locale, section.semester.nameCn)
      : notAvailable}
  </dd>

  <dt class={detailDefinitionTermClass}>{sectionCopy.campus}</dt>
  <dd class="m-0 min-w-0 font-medium">{primaryName(section.campus) || notAvailable}</dd>

  </dl>
</div>
