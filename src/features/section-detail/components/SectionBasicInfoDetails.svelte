<script lang="ts">
import Award from "@lucide/svelte/icons/award";
import BookOpen from "@lucide/svelte/icons/book-open";
import Building from "@lucide/svelte/icons/building-2";
import CalendarClock from "@lucide/svelte/icons/calendar-clock";
import CalendarDays from "@lucide/svelte/icons/calendar-days";
import Clock from "@lucide/svelte/icons/clock";
import DoorOpen from "@lucide/svelte/icons/door-open";
import FilePen from "@lucide/svelte/icons/file-pen-line";
import GraduationCap from "@lucide/svelte/icons/graduation-cap";
import Hash from "@lucide/svelte/icons/hash";
import Languages from "@lucide/svelte/icons/languages";
import MapPin from "@lucide/svelte/icons/map-pin";
import Notebook from "@lucide/svelte/icons/notebook-pen";
import Repeat from "@lucide/svelte/icons/repeat";
import Timer from "@lucide/svelte/icons/timer";
import Users from "@lucide/svelte/icons/users";
import { formatSemesterName } from "@/lib/text/format-semester-name";
import { page } from "$app/state";
import type {
  SectionBasicInfo,
  SectionBasicInfoCopy,
  SectionCommonInfoCopy,
  SectionPrimaryName,
} from "./section-basic-info-types";

export let commonCopy: SectionCommonInfoCopy;
export let notAvailable: string;
export let primaryName: SectionPrimaryName;
export let section: SectionBasicInfo & {
  exams: Array<{ examMode?: string | null }>;
};
export let sectionCopy: SectionBasicInfoCopy;
export let yesNo: (value: boolean | null | undefined) => string;
export let periodDetailRows: Array<[string, number]>;
$: assessmentModes = [
  ...new Set(
    [
      primaryName(section.examMode),
      ...section.exams.map((exam) => exam.examMode?.trim()),
    ].filter(Boolean),
  ),
].join(" · ");
$: teachingRoles = [
  ...new Set(
    (section.teacherAssignments ?? [])
      .map(
        ({ teacherLessonType: type, role }) =>
          (page.data.locale === "en-us"
            ? type?.nameEn || type?.nameCn
            : type?.nameCn || type?.nameEn) || role,
      )
      .filter(Boolean),
  ),
].join(" · ");
type Fact = [string, string | number | null | undefined, typeof Clock];
$: fields = [
  [sectionCopy.sectionCode, section.code, Hash],
  [
    sectionCopy.semester,
    section.semester?.nameCn
      ? formatSemesterName(page.data.locale ?? "zh-cn", section.semester.nameCn)
      : notAvailable,
    CalendarDays,
  ],
  [sectionCopy.campus, primaryName(section.campus) || notAvailable, MapPin],
  [sectionCopy.credits, section.credits ?? notAvailable, Award],
  [
    sectionCopy.summaryCapacityMeta,
    section.stdCount != null || section.limitCount != null
      ? `${section.stdCount ?? 0} / ${section.limitCount ?? notAvailable}`
      : notAvailable,
    Users,
  ],
  [sectionCopy.department, primaryName(section.openDepartment), Building],
  [sectionCopy.teachLanguage, primaryName(section.teachLanguage), Languages],
  [
    commonCopy.undergraduateGraduate,
    yesNo(section.graduateAndPostgraduate),
    GraduationCap,
  ],
  [sectionCopy.totalPeriods, section.period, Clock],
  [sectionCopy.actualPeriods, section.actualPeriods, Timer],
  [sectionCopy.timesPerWeek, section.timesPerWeek, Repeat],
  [sectionCopy.periodsPerWeek, section.periodsPerWeek, CalendarClock],
  ...periodDetailRows.map(([label, value]): Fact => [label, value, BookOpen]),
  [sectionCopy.roomType, primaryName(section.roomType), DoorOpen],
  [sectionCopy.teachingRole, teachingRoles, GraduationCap],
  [sectionCopy.assessmentMode, assessmentModes, FilePen],
  [sectionCopy.remark, section.remark?.trim() || notAvailable, Notebook],
  [sectionCopy.scheduleRemark, section.scheduleRemark?.trim(), Notebook],
] satisfies Fact[];
</script>

<dl class="grid gap-x-6 text-sm @sm/detail:grid-cols-2 @3xl/detail:grid-cols-3">
  {#each fields as [label, value, icon]}
    {#if value != null && value !== ""}
      <div class="grid min-w-0 grid-cols-[minmax(7rem,0.8fr)_minmax(0,1fr)] items-baseline gap-3 border-b py-2.5">
        <dt class="flex items-center gap-2 text-muted-foreground">
          <svelte:component this={icon} aria-hidden="true" class="size-4 shrink-0" />
          {label}
        </dt>
        <dd class:font-mono={label === sectionCopy.sectionCode} class="whitespace-pre-wrap font-medium [overflow-wrap:anywhere]">{value}</dd>
      </div>
    {/if}
  {/each}
</dl>
