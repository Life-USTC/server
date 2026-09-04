<script lang="ts">
import { sectionDetailHomeworkPath } from "@/features/section-detail/lib/section-detail-tab";
import type {
  WorkspaceCopy,
  WorkspaceHomeworkItem,
  WorkspaceRootCopy,
  WorkspaceSessionItem,
  WorkspaceTodoItem,
} from "@/features/workspace/lib/workspace-controller-helpers";
import * as Empty from "$lib/components/ui/empty/index.js";
import * as Item from "$lib/components/ui/item/index.js";
import OverviewSection from "./OverviewSection.svelte";
import type { WorkspaceCalendarTabHref } from "./workspace-calendar-component-types";

export let copy: WorkspaceRootCopy;
export let workspaceCopy: WorkspaceCopy;
export let workspaceTabHref: WorkspaceCalendarTabHref;
export let dueTodayHomeworks: WorkspaceHomeworkItem[];
export let dueTodayTodos: WorkspaceTodoItem[];
export let fmtDate: (date: Date | string | null | undefined) => string;
export let fmtTime: (time: number) => string;
export let sessionHref: (session: WorkspaceSessionItem) => string;
export let todaySessions: WorkspaceSessionItem[];

$: isEmpty =
  todaySessions.length === 0 &&
  dueTodayHomeworks.length === 0 &&
  dueTodayTodos.length === 0;
</script>

<OverviewSection
  href={workspaceTabHref("calendar")}
  title={workspaceCopy.today.title}
>
  {#if isEmpty}
    <Empty.Root class="min-h-20 border-0 px-2 py-6">
      <Empty.Header>
        <Empty.Description>{workspaceCopy.today.empty}</Empty.Description>
      </Empty.Header>
    </Empty.Root>
  {:else}
    <Item.Group class="gap-0">
      {#each todaySessions as session, index (session.id)}
        <Item.Root class="rounded-md border-0 px-2 py-2.5" size="sm">
          {#snippet child({ props })}
            <a href={sessionHref(session)} {...props}>
              <Item.Content class="min-w-0">
                <Item.Title>{session.courseName}</Item.Title>
                <Item.Description>
                  {session.location}
                </Item.Description>
              </Item.Content>
              <Item.Actions class="shrink-0">
                <span class="text-muted-foreground text-xs tabular-nums">
                  {fmtTime(session.startTime)}-{fmtTime(session.endTime)}
                </span>
              </Item.Actions>
            </a>
          {/snippet}
        </Item.Root>
        {#if index < todaySessions.length - 1 || dueTodayHomeworks.length > 0 || dueTodayTodos.length > 0}<Item.Separator class="my-0" />{/if}
      {/each}
      {#each dueTodayHomeworks as homework, index (homework.id)}
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
                  {copy.CalendarEventCard.homework}
                </Item.Description>
              </Item.Content>
              <Item.Actions class="shrink-0">
                <span class="text-muted-foreground text-xs tabular-nums">
                  {fmtDate(homework.submissionDueAt)}
                </span>
              </Item.Actions>
            </a>
          {/snippet}
        </Item.Root>
        {#if index < dueTodayHomeworks.length - 1 || dueTodayTodos.length > 0}<Item.Separator class="my-0" />{/if}
      {/each}
      {#each dueTodayTodos as todo, index (todo.id)}
        <Item.Root class="rounded-md border-0 px-2 py-2.5" size="sm">
          {#snippet child({ props })}
            <a href={workspaceTabHref("todos")} {...props}>
              <Item.Content class="min-w-0">
                <Item.Title>{todo.title}</Item.Title>
                <Item.Description>
                  {copy.CalendarEventCard.todo}
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
        {#if index < dueTodayTodos.length - 1}<Item.Separator class="my-0" />{/if}
      {/each}
    </Item.Group>
  {/if}
</OverviewSection>
