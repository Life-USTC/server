<script lang="ts">
import ArrowUpRight from "@lucide/svelte/icons/arrow-up-right";
import ClassIcon from "@lucide/svelte/icons/graduation-cap";
import type { Snippet } from "svelte";
import TableIconButton from "#lib/components/TableIconButton.svelte";
import TableRowActions from "#lib/components/TableRowActions.svelte";
import TruncatedText from "#lib/components/TruncatedText.svelte";
import Table from "#lib/components/ui/table/table.svelte";
import type { WorkspaceSectionCopy } from "@/features/workspace/lib/workspace-controller-types";
import type { ExamDisplayRow } from "./workspace-exam-component-types";

export let exams: ExamDisplayRow[];
export let roomLinks: Snippet<[ExamDisplayRow["rooms"]]>;
export let empty: Snippet;
export let sectionCopy: WorkspaceSectionCopy;
export let columns: Record<
  "course" | "section" | "date" | "time" | "rooms",
  { names: string[]; label: string }
>;
export let filterControls: Snippet<[string[], string, string]>;
</script>

{#snippet filter(column: (typeof columns)["course"])}
  {@render filterControls(column.names, column.label, "desktop")}
{/snippet}

  <Table class="min-w-0 w-full">
    <thead>
      <tr>
        <th>{@render filter(columns.course)}</th>
        <th>{@render filter(columns.section)}</th>
        <th>{@render filter(columns.date)}</th>
        <th>{@render filter(columns.time)}</th>
        <th>{@render filter(columns.rooms)}</th>
        <th
          ><span class="sr-only">{sectionCopy.moreDetails}</span></th
        >
      </tr>
    </thead>
    <tbody>
      {#each exams as exam}
        <tr class="group">
          <td>
            <a
              class="block min-w-0 max-w-full overflow-hidden py-0.5 font-medium text-foreground"
              href={exam.href}
            >
              <ClassIcon class="me-1 inline size-4" aria-hidden="true" /><TruncatedText text={exam.course} />
            </a>
            <details class="mt-1 text-xs text-muted-foreground">
              <summary class="cursor-pointer py-1">{sectionCopy.moreDetails}</summary>
              <ul class="mt-1 grid gap-1">
                {#each exam.metadata as label}<li>{label}</li>{/each}
              </ul>
            </details>
          </td>
          <td>
            {exam.section}
            <span class="block text-muted-foreground text-sm">{exam.semester}</span>
          </td>
          <td>
            {exam.date}
            <span class="block text-xs text-muted-foreground">{exam.status}</span>
          </td>
          <td>
            {exam.time}
            {#if exam.mode}<span class="block text-xs text-muted-foreground">{exam.mode}</span>{/if}
          </td>
          <td>
            {@render roomLinks(exam.rooms)}
          </td>
          <td>
            <TableRowActions>
              <TableIconButton href={exam.href} label={sectionCopy.moreDetails} icon={ArrowUpRight} />
            </TableRowActions>
          </td>
        </tr>
      {:else}
        <tr class="hover:bg-transparent">
          <td class="p-0" colspan={6}>
            {@render empty()}
          </td>
        </tr>
      {/each}
    </tbody>
  </Table>
