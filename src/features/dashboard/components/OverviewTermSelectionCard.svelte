<script lang="ts">
import BookOpen from "@lucide/svelte/icons/book-open";
import History from "@lucide/svelte/icons/history";
import Search from "@lucide/svelte/icons/search";
import type { DashboardDashboardCopy } from "@/features/dashboard/lib/dashboard-controller-types";
import { Button } from "$lib/components/ui/button/index.js";
import * as Card from "$lib/components/ui/card/index.js";
import { Separator } from "$lib/components/ui/separator/index.js";
import type { DashboardCalendarTabHref } from "./dashboard-calendar-component-types";

export let dashboardCopy: DashboardDashboardCopy;
export let dashboardTabHref: DashboardCalendarTabHref;
export let description: string;
export let historyCalendarSemesterId: number | null = null;
export let showHistoryActions = false;
</script>

<Card.Root>
  <Card.Header>
    <Card.Title>{dashboardCopy.termSelection.title}</Card.Title>
    <Card.Description>{description}</Card.Description>
  </Card.Header>
  <Card.Content>
    <div class="grid gap-2 sm:flex sm:flex-wrap">
      <Button class="w-full sm:w-auto" href={dashboardTabHref("subscriptions")}>
        <Search data-icon="inline-start" />
        {dashboardCopy.termSelection.matchByCode}
      </Button>
      <Button class="w-full sm:w-auto" href="/sections" variant="outline">
        <BookOpen data-icon="inline-start" />
        {dashboardCopy.termSelection.browseSections}
      </Button>
      <Button class="w-full sm:w-auto" href="/courses" variant="outline">
        {dashboardCopy.termSelection.browseCourses}
      </Button>
    </div>
  </Card.Content>
  {#if showHistoryActions}
    <Separator />
    <Card.Footer class="flex-col items-start gap-3">
      <div class="flex min-w-0 items-start gap-2 text-sm text-muted-foreground">
        <History class="mt-0.5 shrink-0" />
        <span>{dashboardCopy.termSelection.historyAvailable}</span>
      </div>
      <div class="grid w-full gap-2 sm:flex sm:flex-wrap">
        <Button class="w-full sm:w-auto" href={dashboardTabHref("homeworks")} size="sm" variant="outline">
          {dashboardCopy.termSelection.viewPastHomeworks}
        </Button>
        <Button
          class="w-full sm:w-auto"
          href={dashboardTabHref("calendar", {
            calendarSemester: historyCalendarSemesterId,
          })}
          size="sm"
          variant="outline"
        >
          {dashboardCopy.termSelection.viewPastSchedule}
        </Button>
        <Button class="w-full sm:w-auto" href={dashboardTabHref("subscriptions")} size="sm" variant="outline">
          {dashboardCopy.termSelection.viewPastSections}
        </Button>
      </div>
    </Card.Footer>
  {/if}
</Card.Root>
