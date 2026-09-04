<script lang="ts">
import { sectionDetailHomeworkPath } from "@/features/section-detail/lib/section-detail-tab";
import { WORKSPACE_OVERVIEW_PREVIEW_LIMIT } from "@/features/workspace/lib/overview-preview";
import type {
  WorkspaceCommonCopy,
  WorkspaceCopy,
  WorkspaceHomeworkItem,
} from "@/features/workspace/lib/workspace-controller-helpers";
import * as Empty from "$lib/components/ui/empty/index.js";
import * as Item from "$lib/components/ui/item/index.js";
import OverviewSection from "./OverviewSection.svelte";
import type { WorkspaceCalendarTabHref } from "./workspace-calendar-component-types";

export let commonCopy: WorkspaceCommonCopy;
export let workspaceCopy: WorkspaceCopy;
export let workspaceTabHref: WorkspaceCalendarTabHref;
export let fmtDate: (date: Date | string | null | undefined) => string;
export let homeworkEtaLabel: (date: Date | string | null | undefined) => string;
export let pendingHomeworks: WorkspaceHomeworkItem[];
export let previewLimit = WORKSPACE_OVERVIEW_PREVIEW_LIMIT;
export let viewAllLabel = "View all";
</script>

<OverviewSection
  href={workspaceTabHref("homeworks")}
  title={workspaceCopy.homeworks.titleV2}
  viewAllHref={workspaceTabHref("homeworks")}
  viewAllLabel={viewAllLabel}
  viewAllVisible={pendingHomeworks.length > previewLimit}
>
  {#if pendingHomeworks.length === 0}
    <Empty.Root class="min-h-20 border-0 px-2 py-6">
      <Empty.Header>
        <Empty.Description>{workspaceCopy.homeworks.empty}</Empty.Description>
      </Empty.Header>
    </Empty.Root>
  {:else}
    {@const homeworkPreview = pendingHomeworks.slice(0, previewLimit)}
    <Item.Group class="gap-0">
      {#each homeworkPreview as homework, index (homework.id)}
        <Item.Root class="rounded-md border-0 px-2 py-2.5" size="sm">
          {#snippet child({ props })}
            <a
              href={homework.section?.jwId
                ? sectionDetailHomeworkPath(homework.section.jwId, {
                    homeworkId: homework.id,
                  })
                : workspaceTabHref("homeworks")}
              {...props}
            >
              <Item.Content class="min-w-0">
                <Item.Title>{homework.title}</Item.Title>
                <Item.Description>
                  {homework.section?.course?.namePrimary ?? commonCopy.sections}
                </Item.Description>
              </Item.Content>
              <Item.Actions class="grid shrink-0 justify-items-end gap-0.5 text-xs">
                <span class="text-foreground">{homeworkEtaLabel(homework.submissionDueAt)}</span>
                <span class="text-muted-foreground tabular-nums">
                  {fmtDate(homework.submissionDueAt)}
                </span>
              </Item.Actions>
            </a>
          {/snippet}
        </Item.Root>
        {#if index < homeworkPreview.length - 1}<Item.Separator class="my-0" />{/if}
      {/each}
    </Item.Group>
  {/if}
</OverviewSection>
