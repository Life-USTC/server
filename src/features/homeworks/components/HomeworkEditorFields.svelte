<script lang="ts">
import { onDestroy, onMount } from "svelte";
import * as Alert from "#lib/components/ui/alert/index.js";
import { Button } from "#lib/components/ui/button/index.js";
import * as Field from "#lib/components/ui/field/index.js";
import { fetchHomeworkClassStarts } from "@/features/homeworks/lib/homework-class-starts-client";
import { buildHomeworkDueShortcuts } from "@/features/homeworks/lib/homework-due-shortcuts";
import HomeworkDescriptionFields from "./HomeworkDescriptionFields.svelte";
import HomeworkStyleGuide from "./HomeworkStyleGuide.svelte";
import HomeworkTagFields from "./HomeworkTagFields.svelte";
import HomeworkTimestampFields from "./HomeworkTimestampFields.svelte";
import HomeworkTitleField from "./HomeworkTitleField.svelte";
import type {
  HomeworkFormCommentsCopy,
  HomeworkFormCopy,
  HomeworkTagCopy,
  HomeworkTimestampActions,
  HomeworkTimestampCapabilities,
  HomeworkTimestampCopy,
} from "./homework-form-types";

type EditorCopy = HomeworkFormCopy & HomeworkTagCopy & HomeworkTimestampCopy;

export let actions: HomeworkTimestampActions = {};
export let advancedOpen = false;
export let capabilities: HomeworkTimestampCapabilities = {};
export let commentsCopy: HomeworkFormCommentsCopy;
export let copy: EditorCopy;
export let description = "";
export let disabled = false;
export let classStarts: string[] = [];
export let sectionJwId: number | string | null | undefined = undefined;
let mounted = false;
let request: AbortController | undefined;
let freshClassStarts: string[] = [];
let classStartsState: "loading" | "failed" | "ready" = "ready";
onMount(() => {
  mounted = true;
});
onDestroy(() => {
  request?.abort();
});
async function refreshClassStarts(
  jwId: number | string | null | undefined,
  requestLocale: string,
) {
  request?.abort();
  freshClassStarts = [];
  if (!jwId) {
    classStartsState = "ready";
    return;
  }
  const owner = new AbortController();
  request = owner;
  classStartsState = "loading";
  try {
    const starts = await fetchHomeworkClassStarts({
      sectionJwId: Number(jwId),
      locale: requestLocale,
      signal: owner.signal,
    });
    if (owner.signal.aborted || request !== owner) return;
    freshClassStarts = starts;
    classStartsState = "ready";
  } catch {
    if (!owner.signal.aborted && request === owner) classStartsState = "failed";
  }
}
export let locale = "zh-cn";
export let idPrefix = "homework";
export let isMajor: boolean | undefined = undefined;
export let markdownModeLabel = "";
export let publishedAt = "";
export let requiresTeam: boolean | undefined = undefined;
export let styleGuidePrefix = idPrefix;
export let submissionDueAt = "";
export let submissionStartAt = "";
export let title = "";

const shortcutReferenceNow = new Date();
$: if (mounted) void refreshClassStarts(sectionJwId, locale);
$: dueShortcuts = buildHomeworkDueShortcuts({
  classStarts: sectionJwId ? freshClassStarts : classStarts,
  copy,
  locale,
  now: shortcutReferenceNow,
});
</script>

<Field.Group class="gap-4">
  {#if sectionJwId && classStartsState === "loading"}
    <p role="status" class="text-sm text-muted-foreground">{copy.classDeadlinesLoading}</p>
  {:else if sectionJwId && classStartsState === "failed"}
    <Alert.Root variant="destructive"><Alert.Description>
      {copy.classDeadlinesFailed}
      <Button type="button" variant="outline" onclick={() => refreshClassStarts(sectionJwId, locale)}>{copy.classDeadlinesRetry}</Button>
    </Alert.Description></Alert.Root>
  {/if}
  <HomeworkTitleField {copy} {disabled} {idPrefix} {title} />
  <HomeworkTimestampFields
    {actions}
    {dueShortcuts}
    bind:advancedOpen
    {capabilities}
    {copy}
    {disabled}
    {idPrefix}
    bind:publishedAt
    bind:submissionDueAt
    bind:submissionStartAt
  >
    {#snippet details()}
      <HomeworkDescriptionFields
        {commentsCopy}
        {copy}
        {description}
        {disabled}
        {idPrefix}
        {markdownModeLabel}
      />
      <HomeworkTagFields
        {copy}
        {disabled}
        {idPrefix}
        {isMajor}
        {requiresTeam}
      />
    {/snippet}
  </HomeworkTimestampFields>
  <HomeworkStyleGuide {copy} testIdPrefix={styleGuidePrefix} />
</Field.Group>
