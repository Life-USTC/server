<script lang="ts">
import { ChevronDownIcon } from "@lucide/svelte";
import { onDestroy, untrack } from "svelte";
import { toast } from "svelte-sonner";
import { Badge } from "#lib/components/ui/badge/index.js";
import { Button } from "#lib/components/ui/button/index.js";
import { Checkbox } from "#lib/components/ui/checkbox/index.js";
import * as Collapsible from "#lib/components/ui/collapsible/index.js";
import * as Field from "#lib/components/ui/field/index.js";
import {
  youngEventSubscriptionStateSchema,
  youngOrganizerSubscriptionStateSchema,
} from "@/lib/api/schemas/young-workspace-schemas";
import type { AppPageCopy } from "@/lib/shell/page-copy";
import { getShellViewer } from "@/lib/shell/shell-viewer";
import { goto, invalidateAll } from "$app/navigation";
import { page } from "$app/state";

let {
  id,
  kind = "events",
  copy,
  initialState,
  compact = false,
  readOnly = false,
  readOnlyReason = "",
  readOnlyLabel = "",
}: {
  id: string;
  kind?: "events" | "organizers";
  copy: AppPageCopy["youngEvents"]["workspace"];
  initialState?: {
    subscribed: boolean;
    remindSignup?: boolean;
    remindDeadline?: boolean;
    remindStart?: boolean;
  };
  compact?: boolean;
  readOnly?: boolean;
  readOnlyReason?: string;
  readOnlyLabel?: string;
} = $props();
let subscribed = $state(untrack(() => initialState?.subscribed ?? false));
let loaded = $state(untrack(() => initialState != null));
let failed = $state(false);
let signedIn = $state(untrack(() => initialState != null));
let busy = $state(false);
let remindSignup = $state(untrack(() => initialState?.remindSignup ?? true));
let remindDeadline = $state(
  untrack(() => initialState?.remindDeadline ?? true),
);
let remindStart = $state(untrack(() => initialState?.remindStart ?? true));
let refresh = $state(0);
let appliedServerState = "";
const endpoint = $derived(
  `/api/workspace/young-${kind === "events" ? "event" : "organizer"}-subscriptions/${encodeURIComponent(id)}`,
);
const prefix = $props.id();
const shellViewer = getShellViewer();
const viewerId = $derived($shellViewer.viewer?.id ?? null);
const viewerStatus = $derived($shellViewer.status);
let destroyed = false;
onDestroy(() => {
  destroyed = true;
});
const actionOwner = $derived(
  JSON.stringify([
    endpoint,
    viewerId,
    viewerStatus,
    readOnly,
    $shellViewer.demo?.fixtureVersion,
    $shellViewer.demo?.expiresAt,
  ]),
);
$effect(() => {
  void actionOwner;
  busy = false;
});
const reminderSummary = $derived(
  [
    remindSignup && copy.signupShort,
    remindDeadline && copy.deadlineShort,
    remindStart && copy.startShort,
  ]
    .filter(Boolean)
    .join(" · ") || copy.noReminders,
);

$effect(() => {
  const url = endpoint;
  if (readOnly) {
    subscribed = initialState?.subscribed ?? false;
    remindSignup = initialState?.remindSignup ?? false;
    remindDeadline = initialState?.remindDeadline ?? false;
    remindStart = initialState?.remindStart ?? false;
    loaded = true;
    signedIn = false;
    failed = false;
    return;
  }
  if (initialState) {
    const serverState = [
      id,
      initialState.subscribed,
      initialState.remindSignup,
      initialState.remindDeadline,
      initialState.remindStart,
    ].join(":");
    // A fresh object identity from the parent must not wipe an in-progress edit.
    if (serverState !== appliedServerState) {
      appliedServerState = serverState;
      subscribed = initialState.subscribed;
      remindSignup = initialState.remindSignup ?? true;
      remindDeadline = initialState.remindDeadline ?? true;
      remindStart = initialState.remindStart ?? true;
    }
    loaded = true;
    signedIn = true;
    failed = false;
    return;
  }
  void refresh;
  loaded = false;
  failed = false;
  subscribed = false;
  signedIn = false;
  if (viewerStatus === "loading") return;
  if (viewerStatus === "error") {
    loaded = true;
    failed = true;
    return;
  }
  if (!viewerId) {
    loaded = true;
    return;
  }
  const controller = new AbortController();
  void (async () => {
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        cache: "no-store",
        credentials: "same-origin",
      });
      if (response.status === 401) {
        signedIn = false;
        loaded = true;
        return;
      }
      if (!response.ok) throw new Error(copy.failed);
      signedIn = true;
      if (kind === "events") {
        const state = youngEventSubscriptionStateSchema.parse(
          await response.json(),
        );
        subscribed = state.subscribed;
        remindSignup = state.remindSignup;
        remindDeadline = state.remindDeadline;
        remindStart = state.remindStart;
      } else {
        subscribed = youngOrganizerSubscriptionStateSchema.parse(
          await response.json(),
        ).subscribed;
      }
    } catch {
      if (!controller.signal.aborted) failed = true;
    } finally {
      if (!controller.signal.aborted) loaded = true;
    }
  })();
  return () => controller.abort();
});

async function retry() {
  if (readOnly) return;
  if (viewerStatus === "error") await shellViewer.retry();
  else refresh++;
}

async function save(next: boolean) {
  if (readOnly) return;
  if (!signedIn) {
    await goto(
      `/account/sign-in?callbackUrl=${encodeURIComponent(page.url.pathname + page.url.search)}`,
    );

    return;
  }
  const owner = actionOwner;
  const current = () => !destroyed && !readOnly && owner === actionOwner;
  busy = true;
  try {
    const response = await fetch(endpoint, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subscribed: next,
        ...(kind === "events"
          ? { remindSignup, remindDeadline, remindStart }
          : {}),
      }),
    });
    if (!response.ok) throw new Error(copy.failed);
    await response.json();
    if (!current()) return;
    subscribed = next;
    toast.success(copy.saved);
    await invalidateAll();
  } catch {
    if (current()) toast.error(copy.failed);
  } finally {
    if (current()) busy = false;
  }
}
</script>

{#if readOnly}<div class="grid gap-1 text-sm" data-testid="demo-young-subscription-facts"><p>{readOnlyLabel}</p><Field.Field orientation="horizontal"><Checkbox id={`${prefix}-fixed-fact`} checked={subscribed} disabled /><Field.FieldLabel for={`${prefix}-fixed-fact`}>{kind === "events" ? copy.subscribed : copy.followed}</Field.FieldLabel></Field.Field>{#if readOnlyReason}<p>{readOnlyReason}</p>{/if}</div>{/if}
{#if compact}
  {#if failed}
    <span class="sr-only" role="alert">{copy.failed}</span>
    <Button variant="outline" onclick={retry}>{copy.retry}</Button>
  {:else}
    <Button
      class="shrink-0"
      disabled={readOnly || !loaded || busy}
      variant="outline"
      onclick={() => save(!subscribed)}
    >
      {subscribed && loaded ? copy.unsubscribe : copy.subscribe}
    </Button>
  {/if}
{:else}
  <div class="grid gap-3">
    <div class="flex flex-wrap items-center gap-3">
      {#if failed}
        <span role="alert">{copy.failed}</span>
        <Button variant="outline" onclick={retry}>{copy.retry}</Button>
      {:else}
        <Button
          disabled={readOnly || !loaded || busy}
          variant="outline"
          onclick={() => save(!subscribed)}
        >
          {readOnly
            ? kind === "events" ? subscribed ? copy.unsubscribe : copy.subscribe : subscribed ? copy.unfollow : copy.follow
            : !loaded
            ? copy.loading
            : !signedIn
              ? copy.signin
              : kind === "events"
                ? subscribed ? copy.unsubscribe : copy.subscribe
                : subscribed ? copy.unfollow : copy.follow}
        </Button>
      {/if}
    {#if subscribed && loaded && !failed}<Badge variant="secondary">{kind === "events" ? copy.subscribed : copy.followed}</Badge>{/if}
    {#if readOnly}<Button href={`/workspace/subscriptions/activities?view=${kind}`} variant="link">{copy.manage}</Button>{:else if !initialState}<Button href="/workspace/subscriptions/activities" variant="link">{copy.manage}</Button>{/if}
    </div>
  {#if !initialState && !readOnly}<p class="text-muted-foreground text-sm">{kind === "events" ? copy.hint : copy.followHint}</p>{/if}
    {#if kind === "events" && subscribed && loaded && !failed}
      <div class="text-muted-foreground text-sm">{copy.reminderSummary.replace("{value}", reminderSummary)}</div>
      <Collapsible.Root class="group/reminders">
        <Collapsible.Trigger>
          {#snippet child({ props })}
            <Button {...props} variant="ghost" size="sm">
              {copy.reminderSettings} 
            <ChevronDownIcon data-icon="inline-end" class="transition-transform group-data-[state=open]/reminders:rotate-180" />
            </Button>
          {/snippet}
        </Collapsible.Trigger>
        <Collapsible.Content>
          <div class="grid gap-3 pt-3">
            <Field.FieldSet disabled={readOnly || busy}>
              <Field.FieldLegend class="sr-only">{copy.reminderSettings}</Field.FieldLegend>
              <Field.FieldGroup>
              <Field.Field orientation="horizontal"><Checkbox id={`${prefix}-signup`} bind:checked={remindSignup} /><Field.FieldLabel for={`${prefix}-signup`}>{copy.signupReminder}</Field.FieldLabel></Field.Field>
              <Field.Field orientation="horizontal"><Checkbox id={`${prefix}-deadline`} bind:checked={remindDeadline} /><Field.FieldLabel for={`${prefix}-deadline`}>{copy.deadlineReminder}</Field.FieldLabel></Field.Field>
              <Field.Field orientation="horizontal"><Checkbox id={`${prefix}-start`} bind:checked={remindStart} /><Field.FieldLabel for={`${prefix}-start`}>{copy.startReminder}</Field.FieldLabel></Field.Field>
              </Field.FieldGroup>
            </Field.FieldSet>
          <Button class="justify-self-start" disabled={readOnly || busy} variant="outline" onclick={() => save(true)}>{copy.save}</Button>
          </div>
        </Collapsible.Content>
      </Collapsible.Root>
    {/if}
  </div>
{/if}
