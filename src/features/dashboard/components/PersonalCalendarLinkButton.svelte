<script lang="ts">
import Link2 from "@lucide/svelte/icons/link-2";
import CalendarSubscriptionDialog from "@/features/calendar/components/CalendarSubscriptionDialog.svelte";
import type { DashboardSectionCopy } from "@/features/dashboard/lib/dashboard-controller-helpers";
import { writeClipboardText } from "@/lib/browser/clipboard";
import { Button } from "$lib/components/ui/button/index.js";

export let buttonLabel: string;
export let className = "";
export let failureMessage: string;
/** When false, only the dialog is rendered; call `open()` from a parent control. */
export let renderTrigger = true;
export let sectionCopy: DashboardSectionCopy;
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
