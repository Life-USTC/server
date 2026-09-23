<script lang="ts">
import { untrack } from "svelte";
import { toast } from "svelte-sonner";
import {
  youngEventSubscriptionStateSchema,
  youngOrganizerSubscriptionStateSchema,
} from "@/lib/api/schemas/young-workspace-schemas";
import type { AppPageCopy } from "@/lib/shell/page-copy";
import { getClientShellBootstrap } from "@/lib/shell/shell-bootstrap";
import { goto, invalidateAll } from "$app/navigation";
import { page } from "$app/stores";
import { Button } from "$lib/components/ui/button";
import { Checkbox } from "$lib/components/ui/checkbox";
import * as Field from "$lib/components/ui/field";

let {
  id,
  kind = "events",
  copy,
  initialState,
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
const endpoint = $derived(
  `/api/workspace/young-${kind === "events" ? "event" : "organizer"}-subscriptions/${encodeURIComponent(id)}`,
);
const prefix = $props.id();

$effect(() => {
  const url = endpoint;
  if (initialState) {
    subscribed = initialState.subscribed;
    remindSignup = initialState.remindSignup ?? true;
    remindDeadline = initialState.remindDeadline ?? true;
    remindStart = initialState.remindStart ?? true;
    loaded = true;
    signedIn = true;
    failed = false;
    return;
  }
  void refresh;
  loaded = false;
  failed = false;
  const controller = new AbortController();
  void (async () => {
    try {
      const { viewer } = await getClientShellBootstrap(
        fetch,
        controller.signal,
      );
      if (!viewer) {
        signedIn = false;
        return;
      }
      const response = await fetch(url, { signal: controller.signal });
      if (response.status === 401) {
        signedIn = false;
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

async function save(next: boolean) {
  if (!signedIn) {
    await goto(
      `/account/sign-in?callbackUrl=${encodeURIComponent($page.url.pathname + $page.url.search)}`,
    );
    return;
  }
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
    subscribed = next;
    toast.success(copy.saved);
    await invalidateAll();
  } catch {
    toast.error(copy.failed);
  } finally {
    busy = false;
  }
}
</script>

<div class="grid gap-3">
  <div class="flex flex-wrap items-center gap-3">
    {#if failed}
      <span role="alert">{copy.failed}</span>
      <Button variant="outline" onclick={() => refresh++}>{copy.retry}</Button>
    {:else}
      <Button disabled={!loaded || busy} variant={subscribed ? "outline" : "default"} onclick={() => save(!subscribed)}>
        {!loaded ? copy.loading : !signedIn ? copy.signin : kind === "events" ? (subscribed ? copy.unsubscribe : copy.subscribe) : (subscribed ? copy.unfollow : copy.follow)}
      </Button>
    {/if}
    {#if !initialState}<Button href="/workspace/subscriptions/activities" variant="link">{copy.manage}</Button>{/if}
  </div>
  {#if !initialState}<p class="text-muted-foreground text-sm">{kind === "events" ? copy.hint : copy.followHint}</p>{/if}
  {#if kind === "events" && subscribed && loaded && !failed}
    <Field.FieldSet disabled={busy}>
      <Field.FieldGroup>
        <Field.Field orientation="horizontal"><Checkbox id={`${prefix}-signup`} bind:checked={remindSignup} /><Field.FieldLabel for={`${prefix}-signup`}>{copy.signupReminder}</Field.FieldLabel></Field.Field>
        <Field.Field orientation="horizontal"><Checkbox id={`${prefix}-deadline`} bind:checked={remindDeadline} /><Field.FieldLabel for={`${prefix}-deadline`}>{copy.deadlineReminder}</Field.FieldLabel></Field.Field>
        <Field.Field orientation="horizontal"><Checkbox id={`${prefix}-start`} bind:checked={remindStart} /><Field.FieldLabel for={`${prefix}-start`}>{copy.startReminder}</Field.FieldLabel></Field.Field>
      </Field.FieldGroup>
    </Field.FieldSet>
    <Button class="justify-self-start" disabled={busy} variant="outline" onclick={() => save(true)}>{copy.save}</Button>
  {/if}
</div>
