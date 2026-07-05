<script lang="ts">
import type {
  DashboardCommonCopy,
  DashboardDashboardCopy,
  DashboardHomeworkItem,
} from "@/features/dashboard/lib/dashboard-controller-helpers";
import { Badge } from "$lib/components/ui/badge/index.js";
import * as Card from "$lib/components/ui/card/index.js";
import * as Empty from "$lib/components/ui/empty/index.js";
import * as Item from "$lib/components/ui/item/index.js";
import type { DashboardCalendarTabHref } from "./dashboard-calendar-component-types";

export let commonCopy: DashboardCommonCopy;
export let dashboardCopy: DashboardDashboardCopy;
export let dashboardTabHref: DashboardCalendarTabHref;
export let fmtDate: (date: Date | string | null | undefined) => string;
export let homeworkEtaLabel: (date: Date | string | null | undefined) => string;
export let pendingHomeworks: DashboardHomeworkItem[];
</script>

<Card.Root>
  <Card.Header>
    <Card.Title>
      <a class="no-underline hover:underline" href={dashboardTabHref("homeworks")}>{dashboardCopy.nav.homeworks.title}</a>
    </Card.Title>
  </Card.Header>
  <Card.Content>
    <Item.Group>
      {#each pendingHomeworks.slice(0, 5) as homework}
        <Item.Root variant="outline" size="sm">
          {#snippet child({ props })}
            <a
              href={homework.section?.jwId
                ? `/sections/${homework.section.jwId}/homework#homework-${homework.id}`
                : dashboardTabHref("homeworks")}
              {...props}
            >
              <Item.Content>
                <Item.Title>{homework.title}</Item.Title>
                <Item.Description>{homework.section?.course?.namePrimary ?? commonCopy.sections}</Item.Description>
              </Item.Content>
              <Item.Actions class="flex-col items-end gap-0">
                <Badge variant="secondary">{homeworkEtaLabel(homework.submissionDueAt)}</Badge>
                <span class="text-muted-foreground text-xs">{fmtDate(homework.submissionDueAt)}</span>
              </Item.Actions>
            </a>
          {/snippet}
        </Item.Root>
      {:else}
        <Empty.Root class="min-h-24">
          <Empty.Header>
            <Empty.Title>{dashboardCopy.homeworks.empty}</Empty.Title>
          </Empty.Header>
        </Empty.Root>
      {/each}
    </Item.Group>
  </Card.Content>
</Card.Root>
