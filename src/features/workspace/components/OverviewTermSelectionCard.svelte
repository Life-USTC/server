<script lang="ts">
import BookOpen from "@lucide/svelte/icons/book-open";
import History from "@lucide/svelte/icons/history";
import Search from "@lucide/svelte/icons/search";
import type { WorkspaceCopy } from "@/features/workspace/lib/workspace-controller-types";
import SoftEmptyMessage from "$lib/components/SoftEmptyMessage.svelte";
import { Button } from "$lib/components/ui/button/index.js";
import OverviewSection from "./OverviewSection.svelte";
import type { WorkspaceCalendarTabHref } from "./workspace-calendar-component-types";

export let workspaceCopy: WorkspaceCopy;
export let workspaceTabHref: WorkspaceCalendarTabHref;
export let description: string;
export let historyCalendarSemesterId: number | null = null;
export let showHistoryActions = false;
</script>

<OverviewSection title={workspaceCopy.termSelection.title}>
  <SoftEmptyMessage message={description} />
  <div class="mt-1 flex flex-wrap gap-2">
    <Button href={workspaceTabHref("subscriptions")}>
      <Search data-icon="inline-start" />
      {workspaceCopy.termSelection.matchByCode}
    </Button>
    <Button href="/catalog/sections" variant="outline">
      <BookOpen data-icon="inline-start" />
      {workspaceCopy.termSelection.browseSections}
    </Button>
    <Button href="/catalog/courses" variant="outline">
      {workspaceCopy.termSelection.browseCourses}
    </Button>
  </div>

  {#if showHistoryActions}
    <div class="mt-4 grid gap-3 border-t border-border/60 pt-4">
      <div class="flex min-w-0 items-start gap-2 text-muted-foreground text-sm">
        <History class="mt-0.5 size-4 shrink-0" />
        <span>{workspaceCopy.termSelection.historyAvailable}</span>
      </div>
      <div class="flex flex-wrap gap-2">
        <Button href={workspaceTabHref("homeworks")} variant="outline">
          {workspaceCopy.termSelection.viewPastHomeworks}
        </Button>
        <Button
          href={workspaceTabHref("calendar", {
            calendarSemester: historyCalendarSemesterId,
          })}
          variant="outline"
        >
          {workspaceCopy.termSelection.viewPastSchedule}
        </Button>
        <Button href={workspaceTabHref("subscriptions")} variant="outline">
          {workspaceCopy.termSelection.viewPastSections}
        </Button>
      </div>
    </div>
  {/if}
</OverviewSection>
