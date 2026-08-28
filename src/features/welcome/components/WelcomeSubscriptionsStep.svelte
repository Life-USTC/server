<script lang="ts">
import ArrowLeft from "@lucide/svelte/icons/arrow-left";
import ArrowRight from "@lucide/svelte/icons/arrow-right";
import Hash from "@lucide/svelte/icons/hash";
import Info from "@lucide/svelte/icons/info";
import Search from "@lucide/svelte/icons/search";
import WelcomeGuideRow from "@/features/welcome/components/WelcomeGuideRow.svelte";
import * as Alert from "$lib/components/ui/alert/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import { Checkbox } from "$lib/components/ui/checkbox/index.js";
import * as Empty from "$lib/components/ui/empty/index.js";
import * as Field from "$lib/components/ui/field/index.js";
import * as NativeSelect from "$lib/components/ui/native-select/index.js";
import { Spinner } from "$lib/components/ui/spinner/index.js";
import { Textarea } from "$lib/components/ui/textarea/index.js";
import type {
  WelcomeBulkImportCopy,
  WelcomeCopy,
  WelcomeDisplayName,
  WelcomeFormatCopy,
  WelcomeImportAction,
  WelcomeMatchedSection,
  WelcomeSectionSelectionSetter,
  WelcomeSelectOption,
} from "./welcome-component-types";

export let areResultsVisible: boolean;
export let backUrl: string | null;
export let bulkCopy: WelcomeBulkImportCopy;
export let canMatch: boolean;
export let confirmImport: WelcomeImportAction;
export let displayName: WelcomeDisplayName;
export let formatCopy: WelcomeFormatCopy;
export let importError: string;
export let importMessage: string;
export let importText: string;
export let isImporting: boolean;
export let isMatching: boolean;
export let matchSections: WelcomeImportAction;
export let matchedSections: WelcomeMatchedSection[];
export let nextUrl: string;
export let selectedCount: number;
export let selectedSectionIdSet: Set<number>;
export let selectedSemesterId: string;
export let semesterOptions: WelcomeSelectOption[];
export let setSectionSelection: WelcomeSectionSelectionSetter;
export let unmatchedCodes: string[];
export let welcomeCopy: WelcomeCopy;

$: codeExamples = [
  {
    code: welcomeCopy.subscriptionsCodeExampleSection,
    hint: welcomeCopy.subscriptionsCodeExampleSectionHint,
  },
  {
    code: welcomeCopy.subscriptionsCodeExampleCourseSection,
    hint: welcomeCopy.subscriptionsCodeExampleCourseSectionHint,
  },
  {
    code: welcomeCopy.subscriptionsCodeExampleCourse,
    hint: welcomeCopy.subscriptionsCodeExampleCourseHint,
  },
];
</script>

<section class="grid gap-6">
  <header class="grid gap-1.5">
    <h2 class="font-semibold leading-none tracking-tight">{welcomeCopy.nextStepsTitle}</h2>
    <p class="text-muted-foreground text-sm">{welcomeCopy.nextStepsDescription}</p>
  </header>

  <div class="grid gap-5">
    <WelcomeGuideRow
      description={welcomeCopy.subscriptionsWhyDescription}
      icon={Info}
      title={welcomeCopy.subscriptionsWhyTitle}
    />

    <WelcomeGuideRow
      description={welcomeCopy.subscriptionsCodesDescription}
      icon={Hash}
      title={welcomeCopy.subscriptionsCodesTitle}
    >
      <ul class="grid gap-1 text-muted-foreground text-xs">
        {#each codeExamples as example (example.code)}
          <li>
            <code class="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">{example.code}</code>
            <span class="ms-2">{example.hint}</span>
          </li>
        {/each}
      </ul>
    </WelcomeGuideRow>

    {#if importError}
      <Alert.Root variant="destructive">
        <Alert.Description>{importError}</Alert.Description>
      </Alert.Root>
    {/if}
    {#if importMessage}
      <Alert.Root>
        <Alert.Description>{importMessage}</Alert.Description>
      </Alert.Root>
    {/if}

    <Field.Group class="gap-4">
      <Field.Field>
        <Field.Label for="welcome-bulk-import-semester">{bulkCopy.semesterLabel}</Field.Label>
        <NativeSelect.Root
          bind:value={selectedSemesterId}
          class="w-full"
          id="welcome-bulk-import-semester"
        >
          {#if !selectedSemesterId}
            <NativeSelect.Option disabled value="">
              {bulkCopy.semesterPlaceholder}
            </NativeSelect.Option>
          {/if}
          {#each semesterOptions as option (option.value)}
            <NativeSelect.Option value={option.value}>{option.label}</NativeSelect.Option>
          {/each}
        </NativeSelect.Root>
      </Field.Field>
      <Field.Field>
        <Field.Label for="welcome-bulk-import-section-codes">
          {welcomeCopy.sectionCodesLabel}
        </Field.Label>
        <Textarea
          id="welcome-bulk-import-section-codes"
          bind:value={importText}
          placeholder={bulkCopy.placeholder}
          rows={5}
        />
      </Field.Field>
      <Button disabled={!canMatch} type="button" onclick={matchSections}>
        {#if isMatching}
          <Spinner data-icon="inline-start" />
        {/if}
        {isMatching ? bulkCopy.matching : bulkCopy.matchButton}
      </Button>
    </Field.Group>

    {#if areResultsVisible}
      <div class="grid gap-3" data-testid="welcome-import-results">
        <div class="grid gap-0.5">
          <p class="font-medium text-sm">{welcomeCopy.confirmImportTitle}</p>
          <p class="text-muted-foreground text-xs leading-5">
            {formatCopy(welcomeCopy.matchedSummary, {
              matched: matchedSections.length,
              unmatched: unmatchedCodes.length,
            })}
          </p>
        </div>
        {#if matchedSections.length > 0}
          <Field.Set>
            <Field.Legend variant="label" class="sr-only">
              {welcomeCopy.confirmImportTitle}
            </Field.Legend>
            <Field.Group data-slot="checkbox-group" class="gap-2">
              {#each matchedSections as section (section.id)}
                {@const checkboxId = `welcome-import-section-${section.id}`}
                <Field.Field orientation="horizontal">
                  <Checkbox
                    id={checkboxId}
                    checked={selectedSectionIdSet.has(section.id)}
                    aria-label={formatCopy(welcomeCopy.selectSection, {
                      code: section.code,
                    })}
                    onCheckedChange={(checked) => {
                      setSectionSelection(section.id, checked === true);
                    }}
                  />
                  <Field.Content>
                    <Field.Label class="cursor-pointer" for={checkboxId}>
                      {displayName(section.course)}
                    </Field.Label>
                    <Field.Description>
                      {section.code}
                      {#if section.semester} · {displayName(section.semester)}{/if}
                      {#if section.campus} · {displayName(section.campus)}{/if}
                      {#if section.teachers.length > 0}
                        · {section.teachers.map(displayName).filter(Boolean).join(", ")}
                      {/if}
                    </Field.Description>
                  </Field.Content>
                </Field.Field>
              {/each}
            </Field.Group>
          </Field.Set>
          <Button
            disabled={selectedCount === 0 || isImporting}
            type="button"
            onclick={confirmImport}
          >
            {#if isImporting}
              <Spinner data-icon="inline-start" />
            {/if}
            {isImporting
              ? welcomeCopy.importing
              : formatCopy(welcomeCopy.subscribeSelected, { count: selectedCount })}
          </Button>
        {:else}
          <Empty.Root class="min-h-20 p-4">
            <Empty.Header>
              <Empty.Description>{welcomeCopy.noMatchingSections}</Empty.Description>
            </Empty.Header>
          </Empty.Root>
        {/if}
        {#if unmatchedCodes.length > 0}
          <Alert.Root>
            <Alert.Title>
              {formatCopy(bulkCopy.unmatchedCodes, { count: unmatchedCodes.length })}
            </Alert.Title>
            <Alert.Description>{unmatchedCodes.join(", ")}</Alert.Description>
          </Alert.Root>
        {/if}
      </div>
    {/if}

    <WelcomeGuideRow
      description={welcomeCopy.subscriptionsBrowseDescription}
      icon={Search}
      title={welcomeCopy.subscriptionsBrowseTitle}
    >
      <div class="flex flex-wrap gap-2">
        <Button href="/catalog/sections" size="sm" variant="outline">
          {welcomeCopy.browseSections}
        </Button>
        <Button href="/catalog/courses" size="sm" variant="outline">
          {welcomeCopy.browseCourses}
        </Button>
      </div>
    </WelcomeGuideRow>
  </div>

  <footer class="flex flex-wrap justify-between gap-2">
    {#if backUrl}
      <Button href={backUrl} variant="ghost">
        <ArrowLeft data-icon="inline-start" />
        {welcomeCopy.back}
      </Button>
    {/if}
    <Button class="ms-auto" href={nextUrl} variant="secondary">
      {welcomeCopy.skipForNow}
      <ArrowRight data-icon="inline-end" />
    </Button>
  </footer>
</section>
