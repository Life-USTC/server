<script lang="ts">
import type { DashboardAgendaDay } from "@/features/dashboard/lib/dashboard-agenda";
import { Badge } from "$lib/components/ui/badge/index.js";
import * as Item from "$lib/components/ui/item/index.js";

export let days: DashboardAgendaDay[];
export let emptyLabel: string;
export let label: string;
export let todayLabel: string;
</script>

<div
  aria-label={label}
  class="grid gap-5"
  data-testid="dashboard-calendar-agenda"
  role="region"
>
  {#each days as day}
    <section aria-labelledby={`agenda-${day.key}`} class="grid gap-2">
      <div class="flex min-h-7 items-center gap-2">
        <h2 id={`agenda-${day.key}`} class="text-sm font-medium">
          {day.weekdayLabel}
          <span class="ml-1 font-normal text-muted-foreground">
            {day.dateLabel}
          </span>
        </h2>
        {#if day.isToday}
          <Badge variant="secondary">{todayLabel}</Badge>
        {/if}
      </div>

      {#if day.events.length > 0}
        <Item.Group class="grid gap-2">
          {#each day.events as event}
            <Item.Root
              class={event.done ? "opacity-60" : undefined}
              size="sm"
              variant={event.done ? "muted" : "outline"}
            >
              {#snippet child({ props })}
                <a href={event.href} {...props}>
                  <Item.Content>
                    <Item.Title class={event.done ? "line-through" : undefined}>
                      {event.title}
                    </Item.Title>
                    <Item.Description>
                      {event.label}{event.meta ? ` · ${event.meta}` : ""}
                    </Item.Description>
                  </Item.Content>
                </a>
              {/snippet}
            </Item.Root>
          {/each}
        </Item.Group>
      {:else}
        <p class="py-1 text-sm text-muted-foreground">{emptyLabel}</p>
      {/if}
    </section>
  {/each}
</div>
