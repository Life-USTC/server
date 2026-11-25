<script lang="ts">
import BookmarkPlusIcon from "@lucide/svelte/icons/bookmark-plus";
import CalendarPlusIcon from "@lucide/svelte/icons/calendar-plus";
import SignInButton from "#lib/components/SignInButton.svelte";
import { Button } from "#lib/components/ui/button/index.js";
import * as Dialog from "#lib/components/ui/dialog/index.js";
import type { SectionSubscriptionCopy } from "@/features/section-detail/server/section-detail-page-copy";
import SectionCancelSubscription from "@/features/subscriptions/components/SectionCancelSubscription.svelte";
import { enhance, type SubmitFunction } from "$app/forms";

export let courseName: string;
export let isSubscribed: boolean;
export let openCalendar: () => void;
export let close: () => void;
export let commonCopy: {
  signIn?: string;
};
export let homeworkCopy: {
  cancel: string;
};
export let sectionCopy: {
  subscriptions: SectionSubscriptionCopy;
  addToCalendar: string;
  unsubscribeLabel: string;
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
    class="sm:max-w-sm"
    aria-labelledby="section-subscribe-title"
  >
    <Dialog.Header>
      <span class="grid size-10 place-items-center rounded-full bg-primary/10 text-primary-text"><BookmarkPlusIcon aria-hidden="true" class="size-5" /></span>
      <Dialog.Title id="section-subscribe-title">
        {sectionCopy.subscribeLabel} · {courseName}
      </Dialog.Title>
      <Dialog.Description>
        {sectionCopy.subscriptionDisclaimer}
      </Dialog.Description>
    </Dialog.Header>
    <Button type="button" class="w-fit" variant="outline" onclick={openCalendar}>
      <CalendarPlusIcon data-icon="inline-start" />{sectionCopy.addToCalendar}
    </Button>
    <div data-slot="dialog-footer">
      <Button variant="secondary" type="button" onclick={close}>
        {homeworkCopy.cancel}
      </Button>
      {#if isSubscribed}
        <SectionCancelSubscription copy={sectionCopy.subscriptions} name={courseName} label={sectionCopy.unsubscribeLabel} pending={subscriptionPendingAction === "unsubscribe"} action={subscriptionAction("unsubscribe")} />
      {:else if signedIn}
        <form
          method="POST"
          action="?/subscribe"
          use:enhance={subscriptionAction("subscribe")}
        >
          <Button type="submit" disabled={subscriptionPendingAction === "subscribe"}>
            <BookmarkPlusIcon data-icon="inline-start" />
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
    </div>
  </Dialog.Content>
</Dialog.Root>
