<script lang="ts">
import CheckCircleIcon from "@lucide/svelte/icons/check-circle";
import SectionCalendarUrlRow from "@/features/section-detail/components/SectionCalendarUrlRow.svelte";
import * as Alert from "$lib/components/ui/alert/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Dialog from "$lib/components/ui/dialog/index.js";

/** Apple Calendar: subscribe by URL guide (locale-neutral). */
const ICAL_SUBSCRIBE_GUIDE_HREF =
  "https://support.apple.com/guide/calendar/subscribe-to-calendars-icl1022/mac";

export let clipboardError: string;
export let clipboardMessage: string;
export let close: () => void;
export let copied: boolean;
export let copyUrl: () => void | Promise<void>;
export let isOpen: boolean;
export let sectionCopy: {
  calendarSheetDescription: string;
  calendarSheetTitle: string;
  close?: string;
  copied: string;
  copyToClipboard: string;
  learnMoreAboutICalendar: string;
  subscriptionMissing: string;
  subscriptionPrivacyNote: string;
  subscriptionUrlDescription: string;
  subscriptionUrlLabel: string;
  viewAllSubscriptions: string;
};
export let setOpen: (open: boolean) => void;
export let showSubscriptionsLink = true;
export let subscriptionCalendarUrl: string;
</script>

<Dialog.Root open={isOpen} onOpenChange={setOpen}>
  <Dialog.Content
    class="max-w-3xl sm:max-w-3xl"
    aria-labelledby="personal-calendar-title"
  >
    <Dialog.Header>
      <Dialog.Title id="personal-calendar-title">
        {sectionCopy.calendarSheetTitle}
      </Dialog.Title>
      <Dialog.Description>
        {sectionCopy.calendarSheetDescription}
        {" "}
        <a
          class="text-primary underline-offset-4 hover:underline"
          href={ICAL_SUBSCRIBE_GUIDE_HREF}
          rel="noopener noreferrer"
          target="_blank"
        >
          {sectionCopy.learnMoreAboutICalendar}
        </a>
      </Dialog.Description>
    </Dialog.Header>
    <section class="grid min-w-0 gap-4 px-5 py-4">
      {#if clipboardMessage}
        <Alert.Root>
          <CheckCircleIcon />
          <Alert.Description>{clipboardMessage}</Alert.Description>
        </Alert.Root>
      {:else if clipboardError}
        <Alert.Root variant="destructive">
          <Alert.Description>{clipboardError}</Alert.Description>
        </Alert.Root>
      {/if}
      <SectionCalendarUrlRow
        buttonLabel={sectionCopy.copyToClipboard}
        {copied}
        copiedLabel={sectionCopy.copied}
        description={sectionCopy.subscriptionUrlDescription}
        id="personal-subscription-url"
        label={sectionCopy.subscriptionUrlLabel}
        missingLabel={sectionCopy.subscriptionMissing}
        onCopy={copyUrl}
        value={subscriptionCalendarUrl}
        warning={sectionCopy.subscriptionPrivacyNote}
      />
      {#if showSubscriptionsLink}
        <Button
          class="w-fit"
          href="/workspace/subscriptions"
          variant="link"
        >
          {sectionCopy.viewAllSubscriptions}
        </Button>
      {/if}
    </section>
    <Dialog.Footer>
      <Button type="button" onclick={close}>{sectionCopy.close ?? ""}</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
