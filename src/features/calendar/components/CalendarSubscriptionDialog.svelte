<script lang="ts" module>
export type CalendarSubscriptionCopy = {
  calendarSheetDescription: string;
  calendarSheetTitle: string;
  close?: string;
  copied: string;
  copyToClipboard: string;
  learnMoreAboutICalendar: string;
  viewAllSubscriptions: string;
};

export type CalendarSubscriptionUrl = {
  copied: boolean;
  description?: string;
  id: string;
  label: string;
  missingLabel?: string;
  onCopy: () => void | Promise<void>;
  value: string;
  warning?: string;
};
</script>

<script lang="ts">
import CalendarDaysIcon from "@lucide/svelte/icons/calendar-days";
import CheckCircleIcon from "@lucide/svelte/icons/check-circle";
import * as Alert from "#lib/components/ui/alert/index.js";
import { Button } from "#lib/components/ui/button/index.js";
import * as Dialog from "#lib/components/ui/dialog/index.js";
import CalendarSubscriptionUrlRow from "./CalendarSubscriptionUrlRow.svelte";

/** Apple Calendar: subscribe by URL guide (locale-neutral). */
const ICAL_SUBSCRIBE_GUIDE_HREF =
  "https://support.apple.com/guide/calendar/subscribe-to-calendars-icl1022/mac";

export let clipboardError: string;
export let clipboardMessage: string;
export let close: () => void;
export let copy: CalendarSubscriptionCopy;
export let isOpen: boolean;
export let onOpenChange: (open: boolean) => void;
export let showSubscriptionsLink = true;
export let urls: CalendarSubscriptionUrl[];

export let personalScope: { label: string; description: string; linkLabel: string } | undefined = undefined;
let scope: "single" | "all" = "single";
$: if (!isOpen) scope = "single";

const titleId = "calendar-subscription-title";
</script>

<Dialog.Root open={isOpen} onOpenChange={onOpenChange}>
  <Dialog.Content class="sm:max-w-xl" aria-labelledby={titleId}>
    <Dialog.Header>
      <Dialog.Title id={titleId} class="flex items-center gap-2"><CalendarDaysIcon aria-hidden="true" class="size-5" />{copy.calendarSheetTitle}</Dialog.Title>
      <Dialog.Description>
        {scope === "all" && personalScope ? personalScope.description : copy.calendarSheetDescription}
        {" "}
        <a
          class="text-primary-text underline underline-offset-4"
          href={ICAL_SUBSCRIBE_GUIDE_HREF}
          rel="noopener noreferrer"
          target="_blank"
        >
          {copy.learnMoreAboutICalendar}
        </a>
      </Dialog.Description>
    </Dialog.Header>
    {#if personalScope}
      <fieldset class="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1" aria-label={copy.calendarSheetTitle}>
        {#each [["single", urls[0]?.label], ["all", personalScope.label]] as [value, label]}
          <label class="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-md px-2 text-sm has-checked:bg-background has-checked:font-medium has-checked:shadow-sm">
            <input type="radio" name="calendar-scope" bind:group={scope} {value} />{label}
          </label>
        {/each}
      </fieldset>
    {/if}
    <section class="grid min-w-0 gap-4 rounded-xl border p-4">
      {#if scope === "all" && personalScope}
        <a class="text-sm underline underline-offset-4" href="/workspace/subscriptions?calendarLink=1">{personalScope.linkLabel}</a>
      {:else}
      {#if clipboardMessage}
        <Alert.Root>
          <CheckCircleIcon />
          <Alert.Description>{clipboardMessage}</Alert.Description>
        </Alert.Root>
      {:else if clipboardError}
        <Alert.Message variant="destructive">{clipboardError}</Alert.Message>
      {/if}
      {#each urls as url}
        <CalendarSubscriptionUrlRow
          buttonLabel={copy.copyToClipboard}
          copied={url.copied}
          copiedLabel={copy.copied}
          description={url.description}
          id={url.id}
          label={url.label}
          missingLabel={url.missingLabel}
          onCopy={url.onCopy}
          value={url.value}
          warning={url.warning}
        />
      {/each}
      {/if}
      {#if showSubscriptionsLink}
        <Button class="w-fit" href="/workspace/subscriptions" variant="link">
          {copy.viewAllSubscriptions}
        </Button>
      {/if}
    </section>
    <div data-slot="dialog-footer">
      <Button onclick={close}>{copy.close ?? ""}</Button>
    </div>
  </Dialog.Content>
</Dialog.Root>
