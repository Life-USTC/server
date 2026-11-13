<script lang="ts">
import CalendarIcon from "@lucide/svelte/icons/calendar";
import LinkIcon from "@lucide/svelte/icons/link-2";
import { Button } from "#lib/components/ui/button/index.js";
import { Skeleton } from "#lib/components/ui/skeleton/index.js";
import SectionCancelSubscription from "@/features/subscriptions/components/SectionCancelSubscription.svelte";
import type { SubmitFunction } from "$app/forms";

type SubscriptionActionKey = "subscribe" | "unsubscribe";

type SectionActionsCopy = {
  addToCalendar: string;
  subscribeLabel: string;
  unsubscribeLabel: string;
  unsubscribing: string;
};

export let courseName: string;
export let onOpenCalendar: () => void;
export let onOpenSubscribe: () => void;
export let retired = false;
export let readOnlyReason: string | undefined = undefined;
export let sectionCopy: SectionActionsCopy;
export let stretched = false;
export let subscriptionAction: (
  action: SubscriptionActionKey,
) => SubmitFunction;
export let subscriptionPendingAction: SubscriptionActionKey | null;
export let viewer: {
  isSubscribed?: boolean;
  loading?: boolean;
  failed?: boolean;
};
</script>

<div
  class={stretched
    ? retired && !viewer.isSubscribed
      ? "grid w-full grid-cols-1 gap-2 [&_[data-slot=button]]:h-auto [&_[data-slot=button]]:whitespace-normal"
      : "grid w-full grid-cols-1 gap-2 min-[360px]:grid-cols-2 [&_[data-slot=button]]:h-auto [&_[data-slot=button]]:whitespace-normal"
    : "flex flex-wrap gap-2"}
>
  <Button
    class={stretched ? "w-full" : undefined}
    variant="outline"
    type="button"
    onclick={onOpenCalendar}
    disabled={Boolean(readOnlyReason)}
    title={readOnlyReason}
  >
    <CalendarIcon data-icon="inline-start" />
    {sectionCopy.addToCalendar}
  </Button>
  {#if viewer.loading}
    <Skeleton class="h-9 w-28" />
  {:else if !viewer.failed && viewer.isSubscribed}
    <SectionCancelSubscription name={courseName} label={sectionCopy.unsubscribeLabel} pending={subscriptionPendingAction === "unsubscribe"} {stretched} {readOnlyReason} action={subscriptionAction("unsubscribe")} />
  {:else if !viewer.failed && !retired}
    <form class={stretched ? "w-full" : undefined} method="GET">
      <input name="subscribe" type="hidden" value="1" />
      <Button
        class={stretched ? "w-full" : undefined}
        aria-haspopup="dialog"
        type="submit"
        disabled={Boolean(readOnlyReason)}
        title={readOnlyReason}
        onclick={(event) => {
          // Keep the GET form as a no-JavaScript deep-link fallback, but avoid
          // reloading the page when the local subscribe dialog is available.
          event.preventDefault();
          onOpenSubscribe();
        }}
      >
        <LinkIcon data-icon="inline-start" />
        {sectionCopy.subscribeLabel}
      </Button>
    </form>
  {/if}
</div>
