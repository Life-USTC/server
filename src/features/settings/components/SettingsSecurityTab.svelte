<script lang="ts">
import ActivityIcon from "@lucide/svelte/icons/activity";
import ShieldAlertIcon from "@lucide/svelte/icons/shield-alert";
import { groupSecurityActivity } from "@/features/settings/lib/security-activity-groups";
import * as Alert from "$lib/components/ui/alert/index.js";
import * as AlertDialog from "$lib/components/ui/alert-dialog/index.js";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Empty from "$lib/components/ui/empty/index.js";
import * as Item from "$lib/components/ui/item/index.js";
import { Separator } from "$lib/components/ui/separator/index.js";
import type {
  SettingsCopy,
  SettingsSecurityActivity,
} from "./settings-component-types";

export let activity: SettingsSecurityActivity;
export let copy: SettingsCopy;
export let locale: "en-us" | "zh-cn";

let rotateDialogOpen = false;

const dateFormatter = new Intl.DateTimeFormat(locale, {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Shanghai",
});

$: groupedActivity = groupSecurityActivity(activity.items);

function label(
  labels: Record<string, string>,
  value: string,
  fallback: string,
) {
  return labels[value] ?? fallback;
}

function repeatedLabel(count: number) {
  return copy.settings.security.repeated.replace("{count}", String(count));
}

function activityTimeLabel(group: (typeof groupedActivity)[number]) {
  const newest = dateFormatter.format(new Date(group.event.createdAt));
  if (group.count === 1) return newest;
  const oldest = dateFormatter.format(new Date(group.oldestCreatedAt));
  return `${oldest} – ${newest}`;
}
</script>

<section aria-labelledby="calendar-token-title" class="grid gap-3 border-y py-4">
  <div class="grid gap-1">
    <h2 id="calendar-token-title" class="text-base font-semibold">
      {copy.settings.security.calendarTokenTitle}
    </h2>
    <p class="text-sm text-muted-foreground">
      {copy.settings.security.calendarTokenDescription}
    </p>
  </div>
  <div>
    <Button class="max-sm:w-full" type="button" variant="outline" onclick={() => (rotateDialogOpen = true)}>
      {copy.settings.security.calendarTokenRotate}
    </Button>
  </div>
</section>

<Alert.Root>
  <ShieldAlertIcon />
  <Alert.Title>{copy.settings.security.responseTitle}</Alert.Title>
  <Alert.Description>
    <div class="grid gap-3">
      <p>{copy.settings.security.responseDescription}</p>
      <div class="flex flex-col gap-2 sm:flex-row">
        <Button href="/account/settings/authorizations" variant="outline">{copy.settings.security.reviewAuthorizations}</Button>
        <Button href="/account/settings/accounts" variant="ghost">{copy.settings.security.reviewAccounts}</Button>
      </div>
    </div>
  </Alert.Description>
</Alert.Root>

<Separator />

<section aria-labelledby="security-activity-title" class="grid gap-4">
  <header class="grid gap-1">
    <h2 id="security-activity-title" class="text-lg font-semibold">{copy.settings.security.title}</h2>
    <p class="text-sm text-muted-foreground">{copy.settings.security.description}</p>
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
      {#each groupedActivity as group (group.event.id)}
        {@const event = group.event}
        <Item.Root role="listitem" variant="outline">
          <Item.Content class="min-w-0">
            <Item.Title>
              {label(copy.settings.security.actions, event.action, copy.settings.security.unknownAction)}
              {#if group.count > 1}<Badge variant="outline">{repeatedLabel(group.count)}</Badge>{/if}
            </Item.Title>
            <Item.Description>{activityTimeLabel(group)}</Item.Description>
          </Item.Content>
          <Item.Actions class="flex-wrap">
            <Badge variant={event.outcome === "success" ? "secondary" : "destructive"}>{label(copy.settings.security.outcomes, event.outcome, event.outcome)}</Badge>
            <Badge variant="outline">{label(copy.settings.security.channels, event.channel, event.channel)}</Badge>
          </Item.Actions>
          {#if event.client || event.network || event.device}
            <Item.Footer>
              <dl class="grid w-full gap-2 text-xs sm:grid-cols-3">
                {#if event.client}<div><dt class="text-muted-foreground">{copy.settings.security.client}</dt><dd>{event.client.name ?? copy.settings.authorizations.unnamedClient}</dd></div>{/if}
                {#if event.network}<div><dt class="text-muted-foreground">{copy.settings.security.network}</dt><dd>{event.network}</dd></div>{/if}
                {#if event.device}<div><dt class="text-muted-foreground">{copy.settings.security.device}</dt><dd>{event.device}</dd></div>{/if}
              </dl>
            </Item.Footer>
          {/if}
        </Item.Root>
      {/each}
    </Item.Group>
  {/if}

  <nav aria-label={copy.settings.security.title} class="flex flex-col justify-end gap-2 sm:flex-row">
    {#if activity.hasCursor}
      <Button class="max-sm:w-full" href="/account/settings/security" variant="ghost">{copy.settings.security.newer}</Button>
    {/if}
    {#if activity.nextCursor}
      <Button class="max-sm:w-full" href={`/account/settings/security?cursor=${encodeURIComponent(activity.nextCursor)}`} variant="outline">{copy.settings.security.older}</Button>
    {/if}
  </nav>
</section>

<AlertDialog.Root bind:open={rotateDialogOpen}>
  <AlertDialog.Content class="max-w-md sm:max-w-md">
    <AlertDialog.Header>
      <AlertDialog.Title>{copy.settings.security.calendarTokenConfirmTitle}</AlertDialog.Title>
      <AlertDialog.Description>{copy.settings.security.calendarTokenConfirmDescription}</AlertDialog.Description>
    </AlertDialog.Header>
    <form method="POST" action="?/rotateCalendarToken">
      <AlertDialog.Footer>
        <AlertDialog.Cancel type="button" variant="outline">{copy.profile.cancel}</AlertDialog.Cancel>
        <Button type="submit" variant="destructive">{copy.settings.security.calendarTokenConfirm}</Button>
      </AlertDialog.Footer>
    </form>
  </AlertDialog.Content>
</AlertDialog.Root>
