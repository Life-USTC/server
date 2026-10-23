<script lang="ts">
import LaptopIcon from "@lucide/svelte/icons/laptop";
import { onMount } from "svelte";
import { toast } from "svelte-sonner";
import {
  buildReauthenticationPageUrl,
  buildSignInPageUrl,
} from "#lib/auth/auth-routing.js";
import { passkeyAuthClient as authClient } from "#lib/auth/passkey-client.js";
import * as Alert from "#lib/components/ui/alert/index.js";
import * as AlertDialog from "#lib/components/ui/alert-dialog/index.js";
import { Badge } from "#lib/components/ui/badge/index.js";
import { Button } from "#lib/components/ui/button/index.js";
import * as Empty from "#lib/components/ui/empty/index.js";
import * as Item from "#lib/components/ui/item/index.js";
import { Skeleton } from "#lib/components/ui/skeleton/index.js";
import { Spinner } from "#lib/components/ui/spinner/index.js";
import { summarizeAuditUserAgent } from "@/features/settings/lib/security-device-label";
import type { AppLocale } from "@/i18n/config";
import type { SettingsCopy } from "./settings-component-types";

type Session = NonNullable<
  Awaited<ReturnType<typeof authClient.listSessions>>["data"]
>[number];
type RevokeAction =
  | { kind: "single"; session: Session }
  | { kind: "others" | "all" };

export let copy: SettingsCopy;
export let locale: AppLocale;

let sessions: Session[] = [];
let currentSessionID: string | null = null;
let loading = true;
let loaded = false;
let revoking = false;
let loadError = false;
let needsReauthentication = false;
let mutationError = false;
let pending: RevokeAction | null = null;
let failedAction: RevokeAction | null = null;
let dialogOpen = false;

$: labels = copy.settings.security.sessions;
$: canRevoke = loaded && !loading && !revoking;
$: hasOtherSessions = sessions.some(
  (session) => session.id !== currentSessionID,
);
$: dateFormatter = new Intl.DateTimeFormat(locale, {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Shanghai",
});
$: confirmation =
  pending?.kind === "all"
    ? labels.confirmAll
    : pending?.kind === "others"
      ? labels.confirmOthers
      : pending?.kind === "single" && pending.session.id === currentSessionID
        ? labels.confirmCurrent
        : labels.confirmOne;

onMount(() => {
  void loadSessions();
});

async function loadSessions() {
  loading = true;
  loaded = false;
  loadError = false;
  needsReauthentication = false;
  try {
    const [list, current] = await Promise.all([
      authClient.listSessions(),
      authClient.getSession(),
    ]);
    if (list.error?.code === "SESSION_NOT_FRESH") {
      needsReauthentication = true;
      return;
    }
    if (list.error || current.error || !current.data) {
      loadError = true;
      return;
    }
    sessions = list.data ?? [];
    currentSessionID = current.data.session.id;
    loaded = true;
  } catch {
    loadError = true;
  } finally {
    loading = false;
  }
}

function confirm(action: RevokeAction) {
  pending = action;
  dialogOpen = true;
}

async function revoke(action: RevokeAction) {
  if (!canRevoke) return;
  dialogOpen = false;
  revoking = true;
  mutationError = false;
  failedAction = null;
  try {
    const result =
      action.kind === "single"
        ? await authClient.revokeSession({ token: action.session.token })
        : action.kind === "others"
          ? await authClient.revokeOtherSessions()
          : await authClient.revokeSessions();
    if (result.error) {
      mutationError = true;
      failedAction = action;
      return;
    }
    if (
      action.kind === "all" ||
      (action.kind === "single" && action.session.id === currentSessionID)
    ) {
      window.location.assign(buildSignInPageUrl("/account/settings/security"));
      return;
    }
    toast.success(labels.revoked);
    await loadSessions();
  } catch {
    mutationError = true;
    failedAction = action;
  } finally {
    revoking = false;
  }
}
</script>

<section aria-labelledby="active-sessions-title" class="grid gap-4" data-session-settings>
  <header class="grid gap-1">
    <h2 id="active-sessions-title" class="text-base font-semibold">{labels.title}</h2>
    <p class="text-sm text-muted-foreground">{labels.description}</p>
  </header>

  {#if loading}
    <div class="flex flex-col gap-2" aria-label={labels.loading} role="status">
      <Skeleton class="h-20 w-full" />
      <Skeleton class="h-20 w-full" />
    </div>
  {/if}
  {#if loadError}
    <Alert.Root variant="destructive">
      <Alert.Title>{labels.loadError}</Alert.Title>
      <Alert.Description>
        <Button type="button" variant="outline" disabled={loading} onclick={loadSessions}>{labels.retry}</Button>
      </Alert.Description>
    </Alert.Root>
  {/if}
  {#if needsReauthentication}
    <Alert.Root>
      <Alert.Title>{labels.reauthenticateDescription}</Alert.Title>
      <Alert.Description>
        <Button href={buildReauthenticationPageUrl("/account/settings/security")} variant="outline">{labels.reauthenticate}</Button>
      </Alert.Description>
    </Alert.Root>
  {/if}
  {#if mutationError}
    <Alert.Root variant="destructive">
      <Alert.Title>{labels.revokeError}</Alert.Title>
      <Alert.Description>
        <Button type="button" variant="outline" disabled={!canRevoke} onclick={() => { if (failedAction) void revoke(failedAction); }}>{labels.retry}</Button>
      </Alert.Description>
    </Alert.Root>
  {/if}

  {#if loaded && sessions.length === 0}
    <Empty.Root>
      <Empty.Header>
        <Empty.Media variant="icon"><LaptopIcon /></Empty.Media>
        <Empty.Title>{labels.empty}</Empty.Title>
      </Empty.Header>
    </Empty.Root>
  {:else if loaded && sessions.length > 0}
    <Item.Group role="list">
      {#each sessions as session (session.id)}
        <Item.Root role="listitem" variant="outline" class="flex-col items-stretch sm:flex-row sm:items-center" data-session-id={session.id}>
          <Item.Content>
            <Item.Title class="flex-wrap line-clamp-none">
              {summarizeAuditUserAgent(session.userAgent ?? null) ?? labels.unknownDevice}
              {#if session.id === currentSessionID}<Badge variant="secondary">{labels.current}</Badge>{/if}
            </Item.Title>
            <Item.Description class="line-clamp-none">
              {labels.createdAt.replace("{time}", dateFormatter.format(new Date(session.createdAt)))}
              <br />
              {labels.expiresAt.replace("{time}", dateFormatter.format(new Date(session.expiresAt)))}
            </Item.Description>
          </Item.Content>
          <Item.Actions class="self-end sm:self-auto">
            <Button type="button" variant="outline" disabled={!canRevoke} onclick={() => confirm({ kind: "single", session })}>
              {labels.revokeOne}
            </Button>
          </Item.Actions>
        </Item.Root>
      {/each}
    </Item.Group>
  {/if}

  <div class="flex flex-col gap-2 sm:flex-row">
    <Button type="button" variant="outline" disabled={!canRevoke || !hasOtherSessions} onclick={() => confirm({ kind: "others" })}>
      {#if revoking}<Spinner data-icon="inline-start" />{/if}
      {labels.revokeOthers}
    </Button>
    <Button type="button" variant="destructive" disabled={!canRevoke || sessions.length === 0} onclick={() => confirm({ kind: "all" })}>
      {labels.revokeAll}
    </Button>
  </div>
</section>

<AlertDialog.Root bind:open={dialogOpen}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>{labels.confirmTitle}</AlertDialog.Title>
      <AlertDialog.Description>{confirmation}</AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel type="button">{copy.profile.cancel}</AlertDialog.Cancel>
      <AlertDialog.Action type="button" variant="destructive" onclick={() => { if (pending) void revoke(pending); }}>
        {labels.confirm}
      </AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
