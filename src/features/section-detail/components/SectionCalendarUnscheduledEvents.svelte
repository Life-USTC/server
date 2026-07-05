<script lang="ts">
import * as Card from "$lib/components/ui/card/index.js";
import * as Item from "$lib/components/ui/item/index.js";
import type {
  SectionCalendarCopy,
  SectionCalendarEvent,
} from "./section-calendar-tab-types";

export let events: SectionCalendarEvent[];
export let sectionCopy: SectionCalendarCopy;
</script>

<Card.Root size="sm">
  <Card.Header>
    <Card.Title>{sectionCopy.dateTBD}</Card.Title>
  </Card.Header>
  <Card.Content>
    <Item.Group class="gap-2">
    {#each events as event}
      <Item.Root size="sm" variant="muted">
        <Item.Content>
          <Item.Title>{event.title}</Item.Title>
        </Item.Content>
        <Item.Actions class="text-muted-foreground text-xs">
          {event.meta}
        </Item.Actions>
      </Item.Root>
    {/each}
    </Item.Group>
  </Card.Content>
</Card.Root>
