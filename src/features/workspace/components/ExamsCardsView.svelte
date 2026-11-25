<script lang="ts">
import ClassIcon from "@lucide/svelte/icons/graduation-cap";
import { sectionSummary } from "@/features/catalog/lib/catalog-list-display";

import type { DemoIdentity } from "@/features/demo/lib/demo-types";
export let pageDemo: DemoIdentity | null | undefined = null;

import ArrowUpRight from "@lucide/svelte/icons/arrow-up-right";
import CollectionEmpty from "#lib/components/CollectionEmpty.svelte";
import MobileListCard from "#lib/components/MobileListCard.svelte";
import TableIconButton from "#lib/components/TableIconButton.svelte";
import { Badge } from "#lib/components/ui/badge/index.js";
import * as Item from "#lib/components/ui/item/index.js";
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

export let locale: string;
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
export let namePrimary: NamePrimary;
export let sectionCopy: ExamsCopyProps["sectionCopy"];
export let subscriptionsCopy: ExamsCopyProps["subscriptionsCopy"];
</script>

<div class="min-w-0" data-testid="workspace-exams-cards">
  <Item.Group class="gap-0">
  {#each exams as exam, index (exam.id)}
    {@const detailHref = exam.section.jwId
      ? `/catalog/sections/${exam.section.jwId}/schedule#exams`
      : workspaceTabHref("subscriptions")}
    <MobileListCard>
      <Item.Content class="min-w-0 gap-1">
        <Item.Title class="line-clamp-none block w-full min-w-0">
          <a
            class="flex min-h-11 w-full min-w-0 max-w-full items-center text-foreground"
            href={detailHref}
          >
            <span class="min-w-0 max-w-full break-words [overflow-wrap:anywhere]">
            <ClassIcon class="me-1 inline size-4" aria-hidden="true" />{sectionSummary(exam.section, locale)}
            </span>
          </a>
        </Item.Title>
        <Item.Description class="line-clamp-none flex min-w-0 flex-wrap gap-x-1.5 gap-y-1 break-words">
          <span class="min-w-0 max-w-full font-mono [overflow-wrap:anywhere]">{exam.section.code ?? subscriptionsCopy.section}</span>
          <span>{formatSemesterName(locale, namePrimary(exam.section.semester) || unknownSemesterLabel)}</span>
        </Item.Description>
        <Item.Description
          class="line-clamp-none flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 break-words"
        >
          <span class="max-w-full break-words">
            {sectionCopy.examDate}: {#if exam.examDate}{fmtExamDate(exam.examDate)}{:else}{sectionCopy.examDateTBD}{/if}
          </span>
          <span class="max-w-full break-words">
            {sectionCopy.examTime}: {examTimeLabel(exam.startTime, exam.endTime) || "—"}
          </span>
          <span class="max-w-full break-words">
            {sectionCopy.room}:
            {#if exam.rooms}
              <span class="inline-flex flex-wrap items-center gap-x-1 gap-y-0.5 align-middle">
                {#each splitRoomLabels(exam.rooms) as room (room)}
                  <RoomMapPreview {pageDemo} {locale} code={room} copy={workspaceCopy.roomMap} />
                {/each}
              </span>
            {:else}
              {sectionCopy.roomTbd}
            {/if}
          </span>
          <Badge variant="outline">
            {exam.completed ? workspaceCopy.nav.exams.filterCompleted : workspaceCopy.nav.exams.filterIncomplete}
          </Badge>
          {#if exam.examMode}<Badge variant="secondary">{exam.examMode}</Badge>{/if}
          {#each examMetadataLabels(exam) as label}<Badge variant="secondary">{label}</Badge>{/each}
        </Item.Description>
      </Item.Content>
      <Item.Actions class="shrink-0 self-start">
        <TableIconButton
          href={detailHref}
          label={sectionCopy.moreDetails}
          icon={ArrowUpRight}
        />
      </Item.Actions>
    </MobileListCard>
    {#if index < exams.length - 1}
      <Item.Separator class="my-0" />
    {/if}
  {:else}
    <CollectionEmpty variant="filter-clear"
      title={hasExamRows ? workspaceCopy.nav.exams.filterEmpty : workspaceCopy.nav.exams.empty}
      description={hasExamRows ? workspaceCopy.nav.exams.filterEmptyDescription : workspaceCopy.nav.exams.emptyDescription}
      clearFilterLabel={workspaceCopy.nav.exams.clearFilter}
      onClearFilter={showClearFilter ? onClearFilter : undefined}
    />
  {/each}
  </Item.Group>
</div>
