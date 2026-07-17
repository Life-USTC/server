<script lang="ts">
import CalendarIcon from "@lucide/svelte/icons/calendar";
import CheckCircleIcon from "@lucide/svelte/icons/check-circle";
import LinkIcon from "@lucide/svelte/icons/link-2";
import type { SubmitFunction } from "@sveltejs/kit";
import { enhance } from "$app/forms";
import { Button } from "$lib/components/ui/button/index.js";

type SubscriptionActionKey = "subscribe" | "unsubscribe";

type SectionActionsCopy = {
  addToCalendar: string;
  subscribeLabel: string;
  unsubscribeLabel: string;
  unsubscribing: string;
};

export let onOpenCalendar: () => void;
export let onOpenSubscribe: () => void;
export let sectionCopy: SectionActionsCopy;
export let stretched = false;
export let subscriptionAction: (
  action: SubscriptionActionKey,
) => SubmitFunction;
export let subscriptionPendingAction: SubscriptionActionKey | null;
export let viewer: { isSubscribed?: boolean };
</script>

<div
  class={stretched
    ? "grid w-full grid-cols-2 gap-2"
    : "flex flex-wrap gap-2"}
>
  <Button
    class={stretched ? "w-full" : undefined}
    variant="outline"
    type="button"
    onclick={onOpenCalendar}
  >
    <CalendarIcon data-icon="inline-start" />
    {sectionCopy.addToCalendar}
  </Button>
  {#if viewer.isSubscribed}
    <form
      class={stretched ? "w-full" : undefined}
      method="POST"
      action="?/unsubscribe"
      use:enhance={subscriptionAction("unsubscribe")}
    >
      <Button
        class={stretched ? "w-full" : undefined}
        variant="outline"
        type="submit"
        disabled={subscriptionPendingAction === "unsubscribe"}
      >
        <CheckCircleIcon data-icon="inline-start" />
        {subscriptionPendingAction === "unsubscribe"
          ? sectionCopy.unsubscribing
          : sectionCopy.unsubscribeLabel}
      </Button>
    </form>
  {:else}
    <form class={stretched ? "w-full" : undefined} method="GET">
      <input name="subscribe" type="hidden" value="1" />
      <Button
        class={stretched ? "w-full" : undefined}
        type="submit"
        onclick={onOpenSubscribe}
      >
        <LinkIcon data-icon="inline-start" />
        {sectionCopy.subscribeLabel}
      </Button>
    </form>
  {/if}
</div>
