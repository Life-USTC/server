<script lang="ts">
import * as Item from "$lib/components/ui/item/index.js";
import type {
  SectionCalendarCopy,
  SectionCalendarEvent,
} from "./section-calendar-tab-types";

export let events: SectionCalendarEvent[];
export let sectionCopy: SectionCalendarCopy;
</script>

<div class="grid gap-3">
  <h3 class="text-sm font-medium">{sectionCopy.dateTBD}</h3>
  <Item.Group class="gap-2">
    {#each events as event}
      <Item.Root size="sm" variant="muted">
        <Item.Content>
          <Item.Title>{event.title}</Item.Title>
        </Item.Content>
        <Item.Actions>
          {event.meta}
        </Item.Actions>
      </Item.Root>
    {/each}
  </Item.Group>
</div>
