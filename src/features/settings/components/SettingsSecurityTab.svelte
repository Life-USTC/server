<script lang="ts">
import ActivityIcon from "@lucide/svelte/icons/activity";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Card from "$lib/components/ui/card/index.js";
import * as Empty from "$lib/components/ui/empty/index.js";
import * as Item from "$lib/components/ui/item/index.js";
import type {
  SettingsCopy,
  SettingsSecurityActivity,
} from "./settings-component-types";

export let activity: SettingsSecurityActivity;
export let copy: SettingsCopy;
export let locale: "en-us" | "zh-cn";

const dateFormatter = new Intl.DateTimeFormat(locale, {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Shanghai",
});

function label(
  labels: Record<string, string>,
  value: string,
  fallback: string,
) {
  return labels[value] ?? fallback;
}
</script>

<Card.Root>
  <Card.Header>
    <Card.Title>{copy.settings.security.calendarTokenTitle}</Card.Title>
    <Card.Description>{copy.settings.security.calendarTokenDescription}</Card.Description>
  </Card.Header>
  <Card.Footer>
    <form method="POST" action="?/rotateCalendarToken">
      <Button type="submit" variant="outline">
        {copy.settings.security.calendarTokenRotate}
      </Button>
    </form>
  </Card.Footer>
</Card.Root>

<section aria-labelledby="security-activity-title" class="grid gap-4">
  <header class="grid gap-1">
    <h2 id="security-activity-title" class="text-lg font-semibold">
      {copy.settings.security.title}
    </h2>
    <p class="text-muted-foreground text-sm">
      {copy.settings.security.description}
    </p>
  </header>

  {#if activity.items.length === 0}
    <Empty.Root>
      <Empty.Header>
        <Empty.Media variant="icon"><ActivityIcon /></Empty.Media>
        <Empty.Title>{copy.settings.security.emptyTitle}</Empty.Title>
        <Empty.Description>{copy.settings.security.emptyDescription}</Empty.Description>
      </Empty.Header>
    </Empty.Root>
  {:else}
    <Item.Group role="list">
      {#each activity.items as event}
        <Item.Root role="listitem" variant="outline">
          <Item.Content class="min-w-0">
            <Item.Title>
              {label(copy.settings.security.actions, event.action, copy.settings.security.unknownAction)}
            </Item.Title>
            <Item.Description>
              {dateFormatter.format(new Date(event.createdAt))}
            </Item.Description>
          </Item.Content>
          <Item.Actions>
            <Badge variant={event.outcome === "success" ? "secondary" : "destructive"}>
              {label(copy.settings.security.outcomes, event.outcome, event.outcome)}
            </Badge>
            <Badge variant="outline">
              {label(copy.settings.security.channels, event.channel, event.channel)}
            </Badge>
          </Item.Actions>
          {#if event.client || event.network || event.device}
            <Item.Footer class="flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {#if event.client}
                <span>{copy.settings.security.client}: {event.client.name ?? event.client.id}</span>
              {/if}
              {#if event.network}
                <span>{copy.settings.security.network}: {event.network}</span>
              {/if}
              {#if event.device}
                <span>{copy.settings.security.device}: {event.device}</span>
              {/if}
            </Item.Footer>
          {/if}
        </Item.Root>
      {/each}
    </Item.Group>
  {/if}

  <nav aria-label={copy.settings.security.title} class="flex justify-end gap-2">
    {#if activity.nextCursor}
      <Button href={`/account/settings/security?cursor=${encodeURIComponent(activity.nextCursor)}`} variant="outline">
        {copy.settings.security.older}
      </Button>
    {/if}
    {#if !activity.nextCursor && activity.items.length > 0}
      <Button href="/account/settings/security" variant="ghost">
        {copy.settings.security.newer}
      </Button>
    {/if}
  </nav>
</section>
