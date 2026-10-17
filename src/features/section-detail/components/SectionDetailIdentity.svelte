<script lang="ts">
import {
  detailDefinitionListClass,
  detailDefinitionTermClass,
} from "#lib/components/detail-definition-list.js";
import { legacyPageStore } from "@/lib/navigation/legacy-page-stores";
import { formatSemesterName } from "@/lib/text/format-semester-name";
import SectionTeachersCard from "./SectionTeachersCard.svelte";
import type {
  SectionBasicInfo,
  SectionBasicInfoCopy,
  SectionPrimaryName,
  SectionTeacherCopy,
  SectionTeacherName,
  SectionTeacherSummary,
} from "./section-basic-info-types";

const page = legacyPageStore();

export let notAvailable: string;
export let primaryName: SectionPrimaryName;
export let section: SectionBasicInfo;
export let sectionCopy: SectionBasicInfoCopy & SectionTeacherCopy;
export let teacherName: SectionTeacherName;
export let teachers: SectionTeacherSummary[];
$: locale = $page.data.locale ?? "zh-cn";
</script>


<div class="grid gap-4">
  <SectionTeachersCard
    primaryName={primaryName}
    sectionCopy={sectionCopy}
    teacherName={teacherName}
    teachers={teachers}
  />

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
