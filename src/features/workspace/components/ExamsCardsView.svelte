<script lang="ts">
import ArrowUpRight from "@lucide/svelte/icons/arrow-up-right";
import ClassIcon from "@lucide/svelte/icons/graduation-cap";
import type { Snippet } from "svelte";
import MobileListCard from "#lib/components/MobileListCard.svelte";
import TableIconButton from "#lib/components/TableIconButton.svelte";
import { Badge } from "#lib/components/ui/badge/index.js";
import * as Item from "#lib/components/ui/item/index.js";
import type { WorkspaceSectionCopy } from "@/features/workspace/lib/workspace-controller-types";
import type { ExamDisplayRow } from "./workspace-exam-component-types";

export let exams: ExamDisplayRow[];
export let roomLinks: Snippet<[ExamDisplayRow["rooms"]]>;
export let empty: Snippet;
export let sectionCopy: WorkspaceSectionCopy;
</script>

<div class="min-w-0" data-testid="workspace-exams-cards">
  <Item.Group class="gap-0">
  {#each exams as exam, index (exam.id)}
    <MobileListCard>
      <Item.Content class="min-w-0 gap-1">
        <Item.Title class="line-clamp-none block w-full min-w-0">
          <a
            class="flex min-h-11 w-full min-w-0 max-w-full items-center text-foreground"
            href={exam.href}
          >
            <span class="min-w-0 max-w-full break-words [overflow-wrap:anywhere]">
            <ClassIcon class="me-1 inline size-4" aria-hidden="true" />{exam.course}
            </span>
          </a>
        </Item.Title>
        <Item.Description class="line-clamp-none flex min-w-0 flex-wrap gap-x-1.5 gap-y-1 break-words">
          <span class="min-w-0 max-w-full font-mono [overflow-wrap:anywhere]">{exam.section}</span>
          <span>{exam.semester}</span>
        </Item.Description>
        <Item.Description
          class="line-clamp-none flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 break-words"
        >
          <span class="max-w-full break-words">
            {sectionCopy.examDate}: {exam.date}
          </span>
          <span class="max-w-full break-words">
            {sectionCopy.examTime}: {exam.time}
          </span>
          <span class="max-w-full break-words">
            {sectionCopy.room}:
            {@render roomLinks(exam.rooms)}
          </span>
          <Badge variant="outline">
            {exam.status}
          </Badge>
          {#if exam.mode}<Badge variant="secondary">{exam.mode}</Badge>{/if}
          {#each exam.metadata as label}<Badge variant="secondary">{label}</Badge>{/each}
        </Item.Description>
      </Item.Content>
      <Item.Actions class="shrink-0 self-start">
        <TableIconButton
          href={exam.href}
          label={sectionCopy.moreDetails}
          icon={ArrowUpRight}
        />
      </Item.Actions>
    </MobileListCard>
    {#if index < exams.length - 1}
      <Item.Separator class="my-0" />
    {/if}
  {:else}
    {@render empty()}
  {/each}
  </Item.Group>
</div>
