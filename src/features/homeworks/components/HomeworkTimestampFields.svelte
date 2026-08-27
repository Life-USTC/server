<script lang="ts">
import CalendarClock from "@lucide/svelte/icons/calendar-clock";
import type { Snippet } from "svelte";
import DateTimePicker from "$lib/components/DateTimePicker.svelte";
import * as Accordion from "$lib/components/ui/accordion/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as ButtonGroup from "$lib/components/ui/button-group/index.js";
import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
import * as Field from "$lib/components/ui/field/index.js";
import type {
  HomeworkTimestampActions,
  HomeworkTimestampCapabilities,
  HomeworkTimestampCopy,
} from "./homework-form-types";

export let actions: HomeworkTimestampActions = {};
export let advancedOpen = false;
export let capabilities: HomeworkTimestampCapabilities = {};
export let copy: HomeworkTimestampCopy;
export let disabled = false;
export let details: Snippet | undefined = undefined;
export let idPrefix = "homework";
export let publishedAt = "";
export let submissionDueAt = "";
export let submissionStartAt = "";

$: hasDueShortcuts = Boolean(
  actions.dueAtSemesterEnd || actions.dueInMonth || actions.dueInWeek,
);
$: hasAdvancedShortcuts = Boolean(
  actions.publishNow || actions.startAtSemesterStart || actions.startNow,
);
</script>

<Field.Group class="gap-4">
  <Field.Field data-disabled={disabled ? "true" : undefined}>
    <Field.Title id={`${idPrefix}-submission-due-label`}>
      {copy.submissionDue}
    </Field.Title>
    <DateTimePicker
      aria-labelledby={`${idPrefix}-submission-due-label`}
      bind:value={submissionDueAt}
      calendarButtonLabel={copy.calendarButtonLabel}
      disabled={disabled}
      name="submissionDueAt"
    />
    {#if hasDueShortcuts}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger>
          {#snippet child({ props })}
            <Button
              {...props}
              class="ml-auto"
              disabled={disabled}
              size="sm"
              type="button"
              variant="outline"
            >
              <CalendarClock data-icon="inline-start" />
              {copy.dueDateShortcuts}
            </Button>
          {/snippet}
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="end">
          <DropdownMenu.Group>
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
    <Accordion.Item class="rounded-md border px-3" value="advanced">
      <Accordion.Trigger class="py-3 hover:no-underline">
        {advancedOpen ? copy.advancedHide : copy.advancedShow}
      </Accordion.Trigger>
      <Accordion.Content class="grid gap-4 pb-3">
        <Field.Group class="grid gap-3 sm:grid-cols-2">
          <Field.Field data-disabled={disabled ? "true" : undefined}>
            <Field.Title id={`${idPrefix}-published-at-label`}>
              {copy.publishedAt}
            </Field.Title>
            <DateTimePicker
              aria-labelledby={`${idPrefix}-published-at-label`}
              bind:value={publishedAt}
              calendarButtonLabel={copy.calendarButtonLabel}
              defaultTime="00:00"
              disabled={disabled}
              name="publishedAt"
            />
            {#if hasAdvancedShortcuts}
              <ButtonGroup.Root class="ml-auto max-w-full flex-wrap justify-end">
                {#if actions.publishNow}
                  <Button
                    disabled={disabled}
                    type="button"
                    variant="outline"
                    onclick={actions.publishNow}
                  >
                    {copy.helperPublishNow}
                  </Button>
                {/if}
                <Button
                  disabled={disabled}
                  type="button"
                  variant="outline"
                  onclick={() => {
                    publishedAt = "";
                  }}
                >
                  {copy.helperClear}
                </Button>
              </ButtonGroup.Root>
            {/if}
          </Field.Field>
          <Field.Field data-disabled={disabled ? "true" : undefined}>
            <Field.Title id={`${idPrefix}-submission-start-label`}>
              {copy.submissionStart}
            </Field.Title>
            <DateTimePicker
              aria-labelledby={`${idPrefix}-submission-start-label`}
              bind:value={submissionStartAt}
              calendarButtonLabel={copy.calendarButtonLabel}
              defaultTime="00:00"
              disabled={disabled}
              name="submissionStartAt"
            />
            <ButtonGroup.Root class="ml-auto max-w-full flex-wrap justify-end">
              {#if actions.startNow}
                <Button
                  disabled={disabled}
                  type="button"
                  variant="outline"
                  onclick={actions.startNow}
                >
                  {copy.helperStartNow}
                </Button>
              {/if}
              {#if actions.startAtSemesterStart}
                <Button
                  disabled={disabled || capabilities.hasSemesterStart === false}
                  type="button"
                  variant="outline"
                  onclick={actions.startAtSemesterStart}
                >
                  {copy.helperSemesterStart}
                </Button>
              {/if}
              <Button
                disabled={disabled}
                type="button"
                variant="outline"
                onclick={() => {
                  submissionStartAt = "";
                }}
              >
                {copy.helperClear}
              </Button>
            </ButtonGroup.Root>
          </Field.Field>
        </Field.Group>
      </Accordion.Content>
    </Accordion.Item>
  </Accordion.Root>

  {#if !advancedOpen}
    <input name="publishedAt" type="hidden" value={publishedAt} />
    <input name="submissionStartAt" type="hidden" value={submissionStartAt} />
  {/if}
</Field.Group>
