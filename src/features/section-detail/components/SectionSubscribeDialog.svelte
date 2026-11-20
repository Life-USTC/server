<script lang="ts">
import LinkIcon from "@lucide/svelte/icons/link-2";
import SignInButton from "#lib/components/SignInButton.svelte";
import { Button } from "#lib/components/ui/button/index.js";
import * as Dialog from "#lib/components/ui/dialog/index.js";
import CalendarSubscriptionUrlRow from "@/features/calendar/components/CalendarSubscriptionUrlRow.svelte";
import SectionCancelSubscription from "@/features/subscriptions/components/SectionCancelSubscription.svelte";
import { enhance, type SubmitFunction } from "$app/forms";

export let courseName: string;
export let isSubscribed: boolean;
export let singleCalendarUrl: string;
export let copied: boolean;
export let clipboardError: string;
export let onCopy: () => void;
let scope: "single" | "all" = "single";
export let close: () => void;
export let commonCopy: {
  signIn?: string;
};
export let homeworkCopy: {
  cancel: string;
};
export let sectionCopy: {
  loginRequired: string;
  calendarSheetDescription: string;
  addToCalendar: string;
  calendarUrlLabel: string;
  subscriptionUrlLabel: string;
  subscriptionUrlDescription: string;
  subscriptionMissing: string;
  unsubscribeLabel: string;
  copied: string;
  copyToClipboard: string;
  subscribeLabel: string;
  subscribing: string;
  subscriptionDisclaimer: string;
};
export let signedIn: boolean;
export let subscriptionAction: (
  action: "subscribe" | "unsubscribe",
) => SubmitFunction;
export let subscriptionPendingAction: "subscribe" | "unsubscribe" | null;
</script>

<Dialog.Root
  open={true}
  onOpenChange={(open) => {
    if (!open) close();
  }}
>
  <Dialog.Content
    class="max-w-lg sm:max-w-lg"
    aria-labelledby="section-subscribe-title"
  >
    <Dialog.Header>
      <Dialog.Title id="section-subscribe-title">
        {sectionCopy.subscribeLabel}
      </Dialog.Title>
      <Dialog.Description>
        {sectionCopy.subscriptionDisclaimer}
      </Dialog.Description>
    </Dialog.Header>
    <fieldset class="grid min-w-0 gap-3">
      <legend class="mb-2 font-medium">{sectionCopy.addToCalendar}</legend>
      <div class="flex flex-wrap gap-4 text-sm">
        <label class="flex items-center gap-2"><input type="radio" bind:group={scope} value="single" />{sectionCopy.calendarUrlLabel}</label>
        <label class="flex items-center gap-2"><input type="radio" bind:group={scope} value="all" />{sectionCopy.subscriptionUrlLabel}</label>
      </div>
      {#if scope === "single"}
        <p class="text-sm text-muted-foreground">{sectionCopy.calendarSheetDescription}</p>
        <CalendarSubscriptionUrlRow buttonLabel={sectionCopy.copyToClipboard} {copied} copiedLabel={sectionCopy.copied} id="section-subscription-feed" label={sectionCopy.calendarUrlLabel} value={singleCalendarUrl} {onCopy} />
        {#if clipboardError}<p role="alert">{clipboardError}</p>{/if}
      {:else}
        <p class="text-sm text-muted-foreground">{sectionCopy.subscriptionUrlDescription}</p>
        <a class="w-fit text-pretty text-sm underline underline-offset-4" href="/workspace/subscriptions?calendarLink=1">{sectionCopy.subscriptionMissing}</a>
      {/if}
    </fieldset>
    <Dialog.Footer>
      <Button variant="secondary" type="button" onclick={close}>
        {homeworkCopy.cancel}
      </Button>
      {#if isSubscribed}
        <SectionCancelSubscription name={courseName} label={sectionCopy.unsubscribeLabel} pending={subscriptionPendingAction === "unsubscribe"} action={subscriptionAction("unsubscribe")} />
      {:else if signedIn}
        <form
          method="POST"
          action="?/subscribe"
          use:enhance={subscriptionAction("subscribe")}
        >
          <Button type="submit" disabled={subscriptionPendingAction === "subscribe"}>
            <LinkIcon data-icon="inline-start" />
            {subscriptionPendingAction === "subscribe"
              ? sectionCopy.subscribing
              : sectionCopy.subscribeLabel}
          </Button>
        </form>
      {:else}
        <SignInButton>
          {commonCopy.signIn ?? ""}
        </SignInButton>
      {/if}
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
