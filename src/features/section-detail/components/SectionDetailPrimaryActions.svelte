<script lang="ts">
import BookmarkPlusIcon from "@lucide/svelte/icons/bookmark-plus";
import CalendarIcon from "@lucide/svelte/icons/calendar";
import { Button } from "#lib/components/ui/button/index.js";
import { Skeleton } from "#lib/components/ui/skeleton/index.js";

type SectionActionsCopy = {
  addToCalendar: string;
  subscribeSuccess: string;
  subscribeLabel: string;
  unsubscribeLabel: string;
  unsubscribing: string;
};

export let onOpenCalendar: () => void;
export let onOpenSubscribe: () => void;
export let retired = false;
export let readOnlyReason: string | undefined = undefined;
export let sectionCopy: SectionActionsCopy;
export let stretched = false;
export let viewer: {
  isSubscribed?: boolean;
  loading?: boolean;
  failed?: boolean;
};
</script>

<div class={stretched ? "grid w-full" : "flex"}>
  {#if viewer.loading}
    <Skeleton class="h-9 w-28" />
  {:else if retired && !viewer.isSubscribed}
    <Button variant="outline" disabled={Boolean(readOnlyReason)} onclick={onOpenCalendar}><CalendarIcon data-icon="inline-start" />{sectionCopy.addToCalendar}</Button>
  {:else if !viewer.failed}
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
        <BookmarkPlusIcon data-icon="inline-start" />
        {viewer.isSubscribed ? sectionCopy.subscribeSuccess : sectionCopy.subscribeLabel}
      </Button>
    </form>
  {/if}
</div>
