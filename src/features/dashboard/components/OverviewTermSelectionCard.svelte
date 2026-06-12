<script lang="ts">
import type { DashboardDashboardCopy } from "@/features/dashboard/lib/dashboard-controller-types";
import { Button } from "$lib/components/ui/button/index.js";
import * as Card from "$lib/components/ui/card/index.js";
import type { DashboardCalendarTabHref } from "./dashboard-calendar-component-types";

export let dashboardCopy: DashboardDashboardCopy;
export let dashboardTabHref: DashboardCalendarTabHref;
export let description: string;
</script>

<Card.Root class="border-base-300 bg-base-100">
  <Card.Header class="items-start gap-4">
    <div>
      <Card.Title>{dashboardCopy.termSelection.title}</Card.Title>
      <Card.Description class="mt-2">
        {description}
      </Card.Description>
    </div>
    <div class="flex flex-wrap gap-2">
      <Button href="/sections">{dashboardCopy.termSelection.browseSections}</Button>
      <Button href="/courses" variant="outline">{dashboardCopy.termSelection.browseCourses}</Button>
      <Button href={dashboardTabHref("subscriptions")} variant="outline">{dashboardCopy.termSelection.matchByCode}</Button>
    </div>
  </Card.Header>
</Card.Root>
