<script lang="ts">
import { Badge } from "$lib/components/ui/badge/index.js";
import * as Item from "$lib/components/ui/item/index.js";
import type {
  SectionCalendarCopy,
  SectionCalendarEvent,
} from "./section-calendar-tab-types";

export let event: SectionCalendarEvent;
export let fmtDate: (value: string | Date | null | undefined) => string;
export let sectionCopy: SectionCalendarCopy;
</script>

<Item.Root class="items-start" id={event.id} variant="outline">
  <Item.Content>
    <Item.Title>{event.title}</Item.Title>
    <Item.Description>
        {fmtDate(event.date)} · {event.meta}
    </Item.Description>
  </Item.Content>
  <Item.Actions>
    <Badge variant={event.kind === "exam" ? "secondary" : "outline"}>
      {event.kind === "exam" ? sectionCopy.examEvent : sectionCopy.classEvent}
    </Badge>
  </Item.Actions>
  <Item.Footer class="block">
    <div class="flex flex-wrap gap-2">
      {#each event.badges as badge}
        <Badge variant="ghost">{badge}</Badge>
      {/each}
    </div>
    {#if event.details.length > 0}
      <Item.Group class="mt-3 grid gap-2 sm:grid-cols-2">
        {#each event.details as detail}
          <Item.Root size="xs" variant="muted">
            <Item.Content>
              <Item.Description>{detail.label}</Item.Description>
              <Item.Title>{detail.value}</Item.Title>
            </Item.Content>
          </Item.Root>
        {/each}
      </Item.Group>
    {/if}
  </Item.Footer>
</Item.Root>
