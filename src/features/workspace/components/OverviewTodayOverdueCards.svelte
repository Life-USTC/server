<script lang="ts">
import { sectionDetailHomeworkPath } from "@/features/section-detail/lib/section-detail-tab";
import { WORKSPACE_OVERVIEW_PREVIEW_LIMIT } from "@/features/workspace/lib/overview-preview";
import type {
  WorkspaceCommonCopy,
  WorkspaceCopy,
  WorkspaceHomeworkItem,
  WorkspaceRootCopy,
  WorkspaceSessionItem,
  WorkspaceTodoItem,
  WorkspaceTodosCopy,
} from "@/features/workspace/lib/workspace-controller-helpers";
import { Badge } from "$lib/components/ui/badge/index.js";
import * as Empty from "$lib/components/ui/empty/index.js";
import * as Item from "$lib/components/ui/item/index.js";
import OverviewSection from "./OverviewSection.svelte";
import OverviewTodayCard from "./OverviewTodayCard.svelte";
import type { WorkspaceCalendarTabHref } from "./workspace-calendar-component-types";

export let copy: WorkspaceRootCopy;
export let commonCopy: WorkspaceCommonCopy;
export let workspaceCopy: WorkspaceCopy;
export let todosCopy: WorkspaceTodosCopy;
export let workspaceTabHref: WorkspaceCalendarTabHref;
export let fmtDate: (date: Date | string | null | undefined) => string;
export let fmtTime: (time: number) => string;
export let homeworkEtaLabel: (date: Date | string | null | undefined) => string;
export let todoStatus: (todo: WorkspaceTodoItem) => string;
export let todaySessions: WorkspaceSessionItem[];
export let dueTodayHomeworks: WorkspaceHomeworkItem[];
export let dueTodayTodos: WorkspaceTodoItem[];
export let overdueHomeworks: WorkspaceHomeworkItem[];
export let overdueTodos: WorkspaceTodoItem[];
export let sessionHref: (session: WorkspaceSessionItem) => string;
export let previewLimit = WORKSPACE_OVERVIEW_PREVIEW_LIMIT;
export let viewAllLabel = "View all";

$: overdueHomeworkPreview = overdueHomeworks.slice(0, previewLimit);
$: overdueTodoPreview = overdueTodos.slice(
  0,
  Math.max(0, previewLimit - overdueHomeworkPreview.length),
);
$: showOverdueViewAll =
  overdueHomeworks.length + overdueTodos.length > previewLimit;
$: overdueEmpty = overdueHomeworks.length === 0 && overdueTodos.length === 0;
</script>

<div class="grid items-start gap-8 lg:grid-cols-2">
  <OverviewTodayCard
    {copy}
    {workspaceCopy}
    {workspaceTabHref}
    {dueTodayHomeworks}
    {dueTodayTodos}
    {fmtDate}
    {fmtTime}
    {sessionHref}
    {todaySessions}
  />

  <OverviewSection
    href={workspaceTabHref("homeworks")}
    title={workspaceCopy.overdue.title}
    viewAllHref={workspaceTabHref("homeworks")}
    viewAllLabel={viewAllLabel}
    viewAllVisible={showOverdueViewAll}
  >
    {#if overdueEmpty}
      <Empty.Root class="min-h-20 border-0 px-2 py-6">
        <Empty.Header>
          <Empty.Description>{workspaceCopy.overdue.empty}</Empty.Description>
        </Empty.Header>
      </Empty.Root>
    {:else}
      <Item.Group class="gap-0">
        {#each overdueHomeworkPreview as homework, index (homework.id)}
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
                <Item.Content class="min-w-0 gap-1">
                  <Item.Title class="line-clamp-2">{homework.title}</Item.Title>
                  <Item.Description class="flex flex-wrap items-center gap-1.5">
                    <Badge variant="secondary">{copy.CalendarEventCard.homework}</Badge>
                    <span>{homework.section?.course?.namePrimary ?? commonCopy.sections}</span>
                  </Item.Description>
                </Item.Content>
                <Item.Actions class="shrink-0">
                  <span class="text-muted-foreground text-xs tabular-nums">
                    {homeworkEtaLabel(homework.submissionDueAt)}
                  </span>
                </Item.Actions>
              </a>
            {/snippet}
          </Item.Root>
          {#if index < overdueHomeworkPreview.length - 1 || overdueTodoPreview.length > 0}<Item.Separator class="my-0" />{/if}
        {/each}
        {#each overdueTodoPreview as todo, index (todo.id)}
          <Item.Root class="rounded-md border-0 px-2 py-2.5" size="sm">
            {#snippet child({ props })}
              <a href={workspaceTabHref("todos")} {...props}>
                <Item.Content class="min-w-0 gap-1">
                  <Item.Title class="line-clamp-2">{todo.title}</Item.Title>
                  <Item.Description class="flex flex-wrap gap-1.5">
                    <Badge variant="secondary">{copy.CalendarEventCard.todo}</Badge>
                    <Badge
                      variant={todo.priority === "high"
                        ? "destructive"
                        : todo.priority === "medium"
                          ? "secondary"
                          : "outline"}
                    >
                      {todosCopy.priority[todo.priority]}
                    </Badge>
                    <Badge variant="ghost">{todoStatus(todo)}</Badge>
                  </Item.Description>
                </Item.Content>
                <Item.Actions class="shrink-0">
                  <span class="text-muted-foreground text-xs tabular-nums">
                    {fmtDate(todo.dueAt)}
                  </span>
                </Item.Actions>
              </a>
            {/snippet}
          </Item.Root>
          {#if index < overdueTodoPreview.length - 1}<Item.Separator class="my-0" />{/if}
        {/each}
      </Item.Group>
    {/if}
  </OverviewSection>
</div>
