<script lang="ts">
import CalendarClock from "@lucide/svelte/icons/calendar-clock";
import type { Snippet } from "svelte";
import DateTimePicker from "$lib/components/DateTimePicker.svelte";
import * as Accordion from "$lib/components/ui/accordion/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
import * as Field from "$lib/components/ui/field/index.js";
import type {
  HomeworkDueShortcut,
  HomeworkTimestampActions,
  HomeworkTimestampCapabilities,
  HomeworkTimestampCopy,
} from "./homework-form-types";

export let actions: HomeworkTimestampActions = {};
export let advancedOpen = false;
export let capabilities: HomeworkTimestampCapabilities = {};
export let copy: HomeworkTimestampCopy;
export let disabled = false;
export let dueShortcuts: HomeworkDueShortcut[] = [];
export let details: Snippet | undefined = undefined;
export let idPrefix = "homework";
export let optionalSettings: Snippet | undefined = undefined;
export let publishedAt = "";
export let submissionDueAt = "";
export let submissionStartAt = "";

$: hasDueShortcuts = Boolean(
  actions.dueAtSemesterEnd ||
    actions.dueInMonth ||
    actions.dueInWeek ||
    dueShortcuts.length > 0,
);
</script>

<Field.Group class="gap-4">
  <Field.Field data-disabled={disabled ? "true" : undefined}>
    <Field.Title id={`${idPrefix}-submission-due-label`}>
      {copy.submissionDue}
    </Field.Title>
    <div class="flex flex-wrap items-end gap-2">
      <DateTimePicker
        aria-labelledby={`${idPrefix}-submission-due-label`}
        bind:value={submissionDueAt}
        calendarButtonLabel={copy.calendarButtonLabel}
        class="min-w-48 flex-1"
        disabled={disabled}
        name="submissionDueAt"
      />
    {#if hasDueShortcuts}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger>
          {#snippet child({ props })}
            <Button
              {...props}
              class="shrink-0"
              disabled={disabled}
              type="button"
              variant="outline"
            >
              <CalendarClock data-icon="inline-start" />
              {copy.dueDateShortcuts}
            </Button>
          {/snippet}
        </DropdownMenu.Trigger>
        <DropdownMenu.Content
          align="end"
          class="w-max max-w-[calc(100vw-2rem)] max-h-[var(--bits-dropdown-menu-content-available-height)]"
        >
          <DropdownMenu.Group>
            {#each dueShortcuts as shortcut}
              <DropdownMenu.Item
                disabled={disabled}
                onSelect={() => {
                  submissionDueAt = shortcut.value;
                }}
              >
                {shortcut.label}
              </DropdownMenu.Item>
            {/each}
            {#if actions.dueInWeek}
              <DropdownMenu.Item disabled={disabled} onSelect={actions.dueInWeek}>
                {copy.helperWeek}
              </DropdownMenu.Item>
            {/if}
            {#if actions.dueInMonth}
              <DropdownMenu.Item disabled={disabled} onSelect={actions.dueInMonth}>
                {copy.helperMonth}
              </DropdownMenu.Item>
            {/if}
            {#if actions.dueAtSemesterEnd}
              <DropdownMenu.Item
                disabled={disabled || capabilities.hasSemesterEnd === false}
                onSelect={actions.dueAtSemesterEnd}
              >
                {copy.helperSemesterEnd}
              </DropdownMenu.Item>
            {/if}
          </DropdownMenu.Group>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    {/if}
    </div>
  </Field.Field>

  {#if details}
    {@render details()}
  {/if}

  <Accordion.Root
    type="single"
    value={advancedOpen ? "advanced" : ""}
    onValueChange={(value) => {
      advancedOpen = value === "advanced";
    }}
  >
    <Accordion.Item class="rounded-lg bg-muted/40 px-3" value="advanced">
      <Accordion.Trigger class="py-3 hover:no-underline">
        {advancedOpen ? copy.advancedHide : copy.advancedShow}
      </Accordion.Trigger>
      <Accordion.Content class="grid gap-4 pb-4">
        <Field.Group class="gap-4">
          <Field.Field data-disabled={disabled ? "true" : undefined}>
            <Field.Title id={`${idPrefix}-published-at-label`}>{copy.publishedAt}</Field.Title>
            <div class="flex flex-wrap items-end gap-2">
              <DateTimePicker
                aria-labelledby={`${idPrefix}-published-at-label`}
                bind:value={publishedAt}
                calendarButtonLabel={copy.calendarButtonLabel}
                class="min-w-48 flex-1"
                defaultTime="00:00"
                {disabled}
                name={advancedOpen ? "publishedAt" : undefined}
              />
              <DropdownMenu.Root>
                <DropdownMenu.Trigger>
                  {#snippet child({ props })}
                    <Button {...props} aria-label={`${copy.publishedAt} · ${copy.timeShortcuts}`} {disabled} type="button" variant="outline">
                      <CalendarClock data-icon="inline-start" />
                      {copy.timeShortcuts}
                    </Button>
                  {/snippet}
                </DropdownMenu.Trigger>
                <DropdownMenu.Content align="end" class="w-max max-w-[calc(100vw-2rem)]">
                  <DropdownMenu.Group>
                  {#if actions.publishNow}
                    <DropdownMenu.Item disabled={disabled} onSelect={actions.publishNow}>
                      {copy.helperPublishNow}
                    </DropdownMenu.Item>
                  {/if}
                    <DropdownMenu.Item {disabled} onSelect={() => { publishedAt = ""; }}>
                      {copy.helperClear}
                    </DropdownMenu.Item>
                  </DropdownMenu.Group>
                </DropdownMenu.Content>
              </DropdownMenu.Root>
            </div>
          </Field.Field>
          <Field.Field data-disabled={disabled ? "true" : undefined}>
            <Field.Title id={`${idPrefix}-submission-start-label`}>{copy.submissionStart}</Field.Title>
            <div class="flex flex-wrap items-end gap-2">
              <DateTimePicker
                aria-labelledby={`${idPrefix}-submission-start-label`}
                bind:value={submissionStartAt}
                calendarButtonLabel={copy.calendarButtonLabel}
                class="min-w-48 flex-1"
                defaultTime="00:00"
                {disabled}
                name={advancedOpen ? "submissionStartAt" : undefined}
              />
              <DropdownMenu.Root>
                <DropdownMenu.Trigger>
                  {#snippet child({ props })}
                    <Button {...props} aria-label={`${copy.submissionStart} · ${copy.timeShortcuts}`} {disabled} type="button" variant="outline">
                      <CalendarClock data-icon="inline-start" />
                      {copy.timeShortcuts}
                    </Button>
                  {/snippet}
                </DropdownMenu.Trigger>
                <DropdownMenu.Content align="end" class="w-max max-w-[calc(100vw-2rem)]">
                  <DropdownMenu.Group>
                  {#if actions.startNow}
                    <DropdownMenu.Item disabled={disabled} onSelect={actions.startNow}>
                      {copy.helperStartNow}
                    </DropdownMenu.Item>
                  {/if}
                  {#if actions.startAtSemesterStart}
                    <DropdownMenu.Item disabled={disabled || capabilities.hasSemesterStart === false} onSelect={actions.startAtSemesterStart}>
                      {copy.helperSemesterStart}
                    </DropdownMenu.Item>
                  {/if}
                    <DropdownMenu.Item {disabled} onSelect={() => { submissionStartAt = ""; }}>
                      {copy.helperClear}
                    </DropdownMenu.Item>
                  </DropdownMenu.Group>
                </DropdownMenu.Content>
              </DropdownMenu.Root>
            </div>
          </Field.Field>
        </Field.Group>
        {#if optionalSettings}
          {@render optionalSettings()}
        {/if}
      </Accordion.Content>
    </Accordion.Item>
  </Accordion.Root>

  {#if !advancedOpen}
    <input name="publishedAt" type="hidden" value={publishedAt} />
    <input name="submissionStartAt" type="hidden" value={submissionStartAt} />
  {/if}
</Field.Group>
