<script lang="ts">
import SectionBasicInfoCard from "./SectionBasicInfoCard.svelte";
import SectionCalendarMiniCard from "./SectionCalendarMiniCard.svelte";
import SectionTeachersCard from "./SectionTeachersCard.svelte";
import type {
  SectionBasicInfo,
  SectionBasicInfoCopy,
  SectionCommonInfoCopy,
  SectionPrimaryName,
  SectionTeacherName,
  SectionTeachersLabel,
} from "./section-basic-info-types";
import type { IsSameMonth } from "./section-detail-component-types";

export let calendarExamDateKeys: Set<string>;
export let calendarMonthDays: Date[];
export let calendarMonthLabel: string;
export let calendarScheduleDateKeys: Set<string>;
export let commonCopy: SectionCommonInfoCopy;
export let dateKey: (value: string | Date | null | undefined) => string | null;
export let isSameMonth: IsSameMonth;
export let notAvailable: string;
export let periodDetailRows: Array<[string, number]>;
export let primaryName: SectionPrimaryName;
export let section: SectionBasicInfo & {
  teachers: Parameters<SectionTeacherName>[0][];
};
export let sectionCopy: SectionBasicInfoCopy & {
  calendarMiniDescription: string;
  classLegend: string;
  examLegend: string;
  noTeachersListed: string;
  teachers: string;
  teachersDescription: string;
  weekdays: {
    shortFriday: string;
    shortMonday: string;
    shortSaturday: string;
    shortSunday: string;
    shortThursday: string;
    shortTuesday: string;
    shortWednesday: string;
  };
};
export let sectionTeachersLabel: SectionTeachersLabel;
export let teacherName: SectionTeacherName;
export let todayCalendarKey: string | null;
export let visibleCalendarMonth: Date;
export let yesNo: (value: boolean | null | undefined) => string;
</script>

<aside class="grid gap-4">
  <SectionCalendarMiniCard
    {calendarExamDateKeys}
    {calendarMonthDays}
    {calendarMonthLabel}
    {calendarScheduleDateKeys}
    {dateKey}
    {isSameMonth}
    {sectionCopy}
    {todayCalendarKey}
    {visibleCalendarMonth}
  />

  <SectionBasicInfoCard
    {commonCopy}
    {notAvailable}
    {periodDetailRows}
    {primaryName}
    {section}
    {sectionCopy}
    {sectionTeachersLabel}
    {yesNo}
  />

  <SectionTeachersCard
    {primaryName}
    {sectionCopy}
    {teacherName}
    teachers={section.teachers}
  />
</aside>
