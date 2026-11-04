<script lang="ts">
import Link2 from "@lucide/svelte/icons/link-2";
import * as Alert from "#lib/components/ui/alert/index.js";
import { Button } from "#lib/components/ui/button/index.js";
import * as Dialog from "#lib/components/ui/dialog/index.js";
import { Spinner } from "#lib/components/ui/spinner/index.js";
import CalendarSubscriptionDialog from "@/features/calendar/components/CalendarSubscriptionDialog.svelte";
import type { WorkspaceSectionCopy } from "@/features/workspace/lib/workspace-controller-helpers";
import { buildReauthenticationPageUrl } from "@/lib/auth/auth-routing";
import { writeClipboardText } from "@/lib/browser/clipboard";
import { getWorkspacePageCopy } from "@/lib/shell/page-copy";
import { refreshAll } from "$app/navigation";
import { page } from "$app/state";

export let calendarLinkState:
  | "ready"
  | "reauthenticate"
  | "unavailable"
  | undefined = undefined;
export let buttonLabel: string;
export let className = "";
export let failureMessage: string;
/** When false, only the dialog is rendered; call `open()` from a parent control. */
export let renderTrigger = true;
export let sectionCopy: WorkspaceSectionCopy;
export let showIcon = false;
export let showSubscriptionsLink = true;
export let size: "default" | "sm" | "lg" | "icon" | undefined = "default";
export let subscriptionCalendarUrl: string;
export let variant:
  | "default"
  | "outline"
  | "secondary"
  | "ghost"
  | "destructive"
  | "link"
  | undefined = "outline";

$: absoluteSubscriptionUrl = (() => {
  if (!subscriptionCalendarUrl) return "";
  if (
    subscriptionCalendarUrl.startsWith("http://") ||
    subscriptionCalendarUrl.startsWith("https://")
  ) {
    return subscriptionCalendarUrl;
  }
  if (typeof window === "undefined") return subscriptionCalendarUrl;
  return `${window.location.origin}${subscriptionCalendarUrl}`;
})();

$: recoveryCopy = getWorkspacePageCopy(
  page.data.locale === "en-us" ? "en-us" : "zh-cn",
).subscriptions.calendarRecovery;
$: returnTo = page.url.pathname + page.url.search;
let retrying = false;
let retryFailed = false;
async function retryLink() {
  if (retrying) return;
  retrying = true;
  retryFailed = false;
  try {
    await refreshAll();
  } catch {
    retryFailed = true;
  } finally {
    retrying = false;
  }
}
let isOpen = false;
let clipboardMessage = "";
let clipboardError = "";
let copied = false;
let resetTimer: ReturnType<typeof setTimeout> | null = null;

function resetClipboardState() {
  clipboardMessage = "";
  clipboardError = "";
  copied = false;
}

export function open() {
  if (resetTimer) {
    clearTimeout(resetTimer);
    resetTimer = null;
  }
  resetClipboardState();
  retryFailed = false;
  isOpen = true;
}

function setOpen(next: boolean) {
  isOpen = next;
  if (!next) {
    if (resetTimer) {
      clearTimeout(resetTimer);
      resetTimer = null;
    }
    resetClipboardState();
  }
}

function close() {
  setOpen(false);
}

async function copyUrl() {
  resetClipboardState();
  if (!absoluteSubscriptionUrl) {
    clipboardError = failureMessage;
    return;
  }
  try {
    await writeClipboardText(absoluteSubscriptionUrl);
    clipboardMessage = sectionCopy.copied;
    copied = true;
    if (resetTimer) clearTimeout(resetTimer);
    resetTimer = setTimeout(() => {
      clipboardMessage = "";
      copied = false;
      resetTimer = null;
    }, 2000);
  } catch {
    clipboardError = failureMessage;
  }
}
</script>

{#if renderTrigger}
  <Button class={className} {size} type="button" {variant} onclick={open}>
    {#if showIcon}
      <Link2 data-icon="inline-start" />
    {/if}
    {buttonLabel}
  </Button>
{/if}

{#if subscriptionCalendarUrl}
<CalendarSubscriptionDialog
  {clipboardError}
  {clipboardMessage}
  {close}
  copy={sectionCopy}
  {isOpen}
  onOpenChange={setOpen}
  {showSubscriptionsLink}
  urls={[{
    copied,
    description: sectionCopy.subscriptionUrlDescription,
    id: "personal-subscription-url",
    label: sectionCopy.subscriptionUrlLabel,
    missingLabel: sectionCopy.subscriptionMissing,
    onCopy: copyUrl,
    value: absoluteSubscriptionUrl,
    warning: sectionCopy.subscriptionPrivacyNote,
  }]}
/>

{:else}
<Dialog.Root open={isOpen} onOpenChange={setOpen}>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>{buttonLabel}</Dialog.Title>
      <Dialog.Description>{calendarLinkState === "reauthenticate" ? recoveryCopy.reauthenticate : recoveryCopy.unavailable}</Dialog.Description>
    </Dialog.Header>
    {#if retryFailed}
      <Alert.Root variant="destructive">
        <Alert.Description>{recoveryCopy.unavailable}</Alert.Description>
      </Alert.Root>
    {/if}
    <Dialog.Footer>
      {#if calendarLinkState === "reauthenticate"}
        <Button href={buildReauthenticationPageUrl(returnTo)}>{recoveryCopy.signIn}</Button>
      {:else}
        <Button disabled={retrying} onclick={retryLink}>
          {#if retrying}<Spinner aria-hidden="true" data-icon="inline-start" />{/if}
          {recoveryCopy.retry}
        </Button>
      {/if}
      <Button variant="outline" onclick={close}>{sectionCopy.close}</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
{/if}
