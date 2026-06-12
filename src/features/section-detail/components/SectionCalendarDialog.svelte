<script lang="ts">
import CheckCircleIcon from "$lib/components/icons/check-circle.svelte";
import { Alert } from "$lib/components/ui/alert/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Dialog from "$lib/components/ui/dialog/index.js";
import SectionCalendarUrlRow from "./SectionCalendarUrlRow.svelte";

export let clipboardError: string;
export let clipboardMessage: string;
export let close: () => void;
export let copiedCalendarTarget: "single" | "subscription" | null;
export let copyText: (
  value: string,
  target: "single" | "subscription",
) => void | Promise<void>;
export let isOpen: boolean;
export let sectionCopy: {
  calendarSheetDescription: string;
  calendarSheetTitle: string;
  calendarUrlLabel: string;
  close?: string;
  copied: string;
  copyToClipboard: string;
  subscriptionMissing: string;
  subscriptionUrlLabel: string;
  viewAllSubscriptions: string;
};
export let setOpen: (open: boolean) => void;
export let singleCalendarUrl: string;
export let subscriptionCalendarUrl: string;
</script>

<Dialog.Root
  open={isOpen}
  class="max-w-3xl"
  aria-labelledby="section-calendar-title"
  onOpenChange={setOpen}
>
  <Dialog.Header>
    <Dialog.Title id="section-calendar-title">
      {sectionCopy.calendarSheetTitle}
    </Dialog.Title>
    <Dialog.Description>
      {sectionCopy.calendarSheetDescription}
    </Dialog.Description>
  </Dialog.Header>
  <section class="grid min-w-0 gap-4 px-5 py-4">
    {#if clipboardMessage}
      <Alert class="flex items-center gap-2" variant="info">
        <CheckCircleIcon class="text-info" />
        {clipboardMessage}
      </Alert>
    {:else if clipboardError}
      <Alert variant="destructive">{clipboardError}</Alert>
    {/if}
    <SectionCalendarUrlRow
      buttonLabel={sectionCopy.copyToClipboard}
      copied={copiedCalendarTarget === "single"}
      copiedLabel={sectionCopy.copied}
      id="calendar-url"
      label={sectionCopy.calendarUrlLabel}
      onCopy={() => copyText(singleCalendarUrl, "single")}
      value={singleCalendarUrl}
    />
    <SectionCalendarUrlRow
      buttonLabel={sectionCopy.copyToClipboard}
      copied={copiedCalendarTarget === "subscription"}
      copiedLabel={sectionCopy.copied}
      id="subscription-url"
      label={sectionCopy.subscriptionUrlLabel}
      missingLabel={sectionCopy.subscriptionMissing}
      onCopy={() => copyText(subscriptionCalendarUrl, "subscription")}
      value={subscriptionCalendarUrl}
    />
    <Button class="w-fit" href="/dashboard/subscriptions" size="sm" variant="link">
      {sectionCopy.viewAllSubscriptions}
    </Button>
  </section>
  <Dialog.Footer>
    <Button type="button" onclick={close}>{sectionCopy.close ?? ""}</Button>
  </Dialog.Footer>
</Dialog.Root>
