<script lang="ts">
import ClassIcon from "@lucide/svelte/icons/graduation-cap";
import { sectionSummary } from "@/features/catalog/lib/catalog-list-display";

import type { DemoIdentity } from "@/features/demo/lib/demo-types";
export let pageDemo: DemoIdentity | null | undefined = null;

import ArrowUpRight from "@lucide/svelte/icons/arrow-up-right";
import type { Snippet } from "svelte";
import CollectionEmpty from "#lib/components/CollectionEmpty.svelte";
import TableIconButton from "#lib/components/TableIconButton.svelte";
import TableRowActions from "#lib/components/TableRowActions.svelte";
import TruncatedText from "#lib/components/TruncatedText.svelte";
import Table from "#lib/components/ui/table/table.svelte";
import RoomMapPreview from "@/features/rooms/components/RoomMapPreview.svelte";
import { splitRoomLabels } from "@/features/rooms/lib/room-map-types";
import { formatSemesterName } from "@/lib/text/format-semester-name";
import type {
  ExamMetadataLabels,
  ExamsCopyProps,
  ExamTimeLabel,
  NamePrimary,
  WorkspaceExamRow,
  WorkspaceTabHref,
} from "./workspace-exam-component-types";

export let filterControls: Snippet<[string[], string, string]>;
export let locale: string;
export let namePrimary: NamePrimary;
export let unknownSemesterLabel: string;
export let workspaceCopy: ExamsCopyProps["workspaceCopy"];
export let workspaceTabHref: WorkspaceTabHref;
export let hasExamRows: boolean;
export let showClearFilter = false;
export let onClearFilter: () => void;
export let exams: WorkspaceExamRow[];
export let examMetadataLabels: ExamMetadataLabels;
export let examTimeLabel: ExamTimeLabel;
export let fmtExamDate: (value: Date | string | null | undefined) => string;
export let sectionCopy: ExamsCopyProps["sectionCopy"];
export let subscriptionsCopy: ExamsCopyProps["subscriptionsCopy"];
</script>

  <Table class="min-w-0 w-full">
    <thead>
      <tr>
        <th>{@render filterControls(["course"], subscriptionsCopy.courseName, "desktop")}</th>
        <th>{@render filterControls(["section", "semester"], subscriptionsCopy.section, "desktop")}</th>
        <th>{@render filterControls(["examDate", "completion"], sectionCopy.examDate, "desktop")}</th>
        <th>{@render filterControls(["startTime", "endTime", "examMode"], sectionCopy.examTime, "desktop")}</th>
        <th>{@render filterControls(["rooms"], sectionCopy.room, "desktop")}</th>
        <th
          ><span class="sr-only">{sectionCopy.moreDetails}</span></th
        >
      </tr>
    </thead>
    <tbody>
      {#each exams as exam}
        {@const detailHref = exam.section.jwId
          ? `/catalog/sections/${exam.section.jwId}/schedule#exams`
          : workspaceTabHref("subscriptions")}
        <tr class="group">
          <td>
            <a
              class="block min-w-0 max-w-full overflow-hidden py-0.5 font-medium text-foreground"
              href={detailHref}
            >
              <ClassIcon class="me-1 inline size-4" aria-hidden="true" /><TruncatedText text={sectionSummary(exam.section, locale)} />
            </a>
            <details class="mt-1 text-xs text-muted-foreground">
              <summary class="cursor-pointer py-1">{sectionCopy.moreDetails}</summary>
              <ul class="mt-1 grid gap-1">
                {#each examMetadataLabels(exam) as label}<li>{label}</li>{/each}
              </ul>
            </details>
          </td>
          <td>
            {exam.section.code ?? subscriptionsCopy.section}
            <span class="block text-muted-foreground text-sm">{formatSemesterName(locale, namePrimary(exam.section.semester) || unknownSemesterLabel)}</span>
          </td>
          <td>
            {#if exam.examDate}{fmtExamDate(exam.examDate)}{:else}{sectionCopy.examDateTBD}{/if}
            <span class="block text-xs text-muted-foreground">{exam.completed ? workspaceCopy.nav.exams.filterCompleted : workspaceCopy.nav.exams.filterIncomplete}</span>
          </td>
          <td>
            {examTimeLabel(exam.startTime, exam.endTime) || "—"}
            {#if exam.examMode}<span class="block text-xs text-muted-foreground">{exam.examMode}</span>{/if}
          </td>
          <td>
            {#if exam.rooms}
              <div class="flex flex-wrap items-center gap-x-1 gap-y-0.5">
                {#each splitRoomLabels(exam.rooms) as room (room)}
                  <RoomMapPreview {pageDemo} {locale} code={room} copy={workspaceCopy.roomMap} />
                {/each}
              </div>
            {:else}
              {sectionCopy.roomTbd}
            {/if}
          </td>
          <td>
            <TableRowActions>
              <TableIconButton href={detailHref} label={sectionCopy.moreDetails} icon={ArrowUpRight} />
            </TableRowActions>
          </td>
        </tr>
      {:else}
        <tr class="hover:bg-transparent">
          <td class="p-0" colspan={6}>
            <CollectionEmpty variant="filter-clear"
              title={hasExamRows ? workspaceCopy.nav.exams.filterEmpty : workspaceCopy.nav.exams.empty}
              description={hasExamRows ? workspaceCopy.nav.exams.filterEmptyDescription : workspaceCopy.nav.exams.emptyDescription}
              clearFilterLabel={workspaceCopy.nav.exams.clearFilter}
              onClearFilter={showClearFilter ? onClearFilter : undefined}
            />
          </td>
        </tr>
      {/each}
    </tbody>
  </Table>
