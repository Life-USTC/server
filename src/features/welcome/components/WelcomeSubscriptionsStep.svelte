<script lang="ts">
import ArrowLeft from "@lucide/svelte/icons/arrow-left";
import ArrowRight from "@lucide/svelte/icons/arrow-right";
import CollectionEmpty from "#lib/components/CollectionEmpty.svelte";
import * as Alert from "#lib/components/ui/alert/index.js";
import { Button } from "#lib/components/ui/button/index.js";
import { Checkbox } from "#lib/components/ui/checkbox/index.js";
import * as Field from "#lib/components/ui/field/index.js";
import * as NativeSelect from "#lib/components/ui/native-select/index.js";
import { Textarea } from "#lib/components/ui/textarea/index.js";
import SectionCardIdentity from "@/features/catalog/components/SectionCardIdentity.svelte";
import {
  GRADUATE_ACADEMIC_PORTAL_URL,
  UNDERGRADUATE_ACADEMIC_PORTAL_URL,
} from "@/features/welcome/lib/welcome-academic-portals";
import type { createWelcomeBulkImportActions } from "../lib/welcome-bulk-import-actions";
import type { createWelcomeControllerDefaultState } from "../lib/welcome-controller-default-state";
import { buildWelcomeSemesterOptions } from "../lib/welcome-controller-state";
import {
  displayWelcomeName,
  formatWelcomeCopy as formatCopy,
} from "../lib/welcome-display";
import type { WelcomePageData } from "./welcome-component-types";

export let data: WelcomePageData;
export let state: ReturnType<typeof createWelcomeControllerDefaultState>;
export let actions: ReturnType<typeof createWelcomeBulkImportActions>;
export let importText: string;
export let selectedSemesterId: string;

$: welcomeCopy = data.copy.welcome;
$: bulkCopy = data.copy.subscriptions.bulkImport;
$: semesterOptions = buildWelcomeSemesterOptions(data.semesters, data.locale);
$: selectedSectionIdSet = new Set(state.selectedSectionIds);
$: selectedCount = state.selectedSectionIds.length;
$: canMatch = importText.trim().length > 0 && !state.isMatching;
</script>

<section class="grid gap-6">
  <header class="grid gap-2">
    <h2 class="font-semibold leading-none tracking-tight">{welcomeCopy.nextStepsTitle}</h2>
    <p class="text-muted-foreground text-sm leading-6">
      {welcomeCopy.nextStepsDescriptionBefore}<a
        class="break-all font-medium text-foreground underline underline-offset-2"
        href={UNDERGRADUATE_ACADEMIC_PORTAL_URL}
        rel="noreferrer"
        target="_blank"><span class="sr-only">{welcomeCopy.subscriptionsUndergraduatePortal} </span>{UNDERGRADUATE_ACADEMIC_PORTAL_URL}</a
      >{welcomeCopy.nextStepsDescriptionBetween}<a
        class="break-all font-medium text-foreground underline underline-offset-2"
        href={GRADUATE_ACADEMIC_PORTAL_URL}
        rel="noreferrer"
        target="_blank"><span class="sr-only">{welcomeCopy.subscriptionsGraduatePortal} </span>{GRADUATE_ACADEMIC_PORTAL_URL}</a
      >{welcomeCopy.nextStepsDescriptionAfter}
    </p>
    <p class="text-muted-foreground text-sm leading-6">{welcomeCopy.nextStepsPasteHint}</p>
  </header>

  <div class="grid gap-5">
    {#if state.importError}
      <Alert.Message variant="destructive">{state.importError}</Alert.Message>
    {/if}
    {#if state.importMessage}
      <Alert.Root>
        <Alert.Description>
          {state.importMessage}
          {#if state.importIncludedSummary}
            <span class="block text-muted-foreground" data-testid="welcome-import-included">
              {state.importIncludedSummary}
            </span>
          {/if}
        </Alert.Description>
      </Alert.Root>
    {/if}

    <Field.Group class="gap-4">
      <Field.Field for="welcome-bulk-import-semester" label={bulkCopy.semesterLabel}>
        <NativeSelect.Root
          bind:value={selectedSemesterId}
          class="w-full"
          id="welcome-bulk-import-semester"
          options={semesterOptions}
          emptyLabel={bulkCopy.semesterPlaceholder}
        />
      </Field.Field>
      <Field.Field for="welcome-bulk-import-section-codes" label={welcomeCopy.sectionCodesLabel}>
        <Textarea
          id="welcome-bulk-import-section-codes"
          bind:value={importText}
          placeholder={bulkCopy.placeholder}
          rows={5}
        />
      </Field.Field>
      <Button loading={state.isMatching} disabled={!canMatch} onclick={actions.matchSections}>
        {state.isMatching ? bulkCopy.matching : welcomeCopy.importButton}
      </Button>
    </Field.Group>

    {#if state.areResultsVisible}
      <div class="grid gap-3" data-testid="welcome-import-results">
        <div class="grid gap-0.5">
          <p class="font-medium text-sm">{welcomeCopy.confirmImportTitle}</p>
          <p class="text-muted-foreground text-xs leading-5">
            {formatCopy(welcomeCopy.matchedSummary, {
              matched: state.matchedSections.length,
              unmatched: state.unmatchedCodes.length,
            })}
          </p>
        </div>
        {#if state.matchedSections.length > 0}
          <Field.Set>
            <Field.Legend variant="label" class="sr-only">
              {welcomeCopy.confirmImportTitle}
            </Field.Legend>
            <Field.Group data-slot="checkbox-group" class="gap-2">
              {#each state.matchedSections as section (section.id)}
                {@const checkboxId = `welcome-import-section-${section.id}`}
                <Field.Field orientation="horizontal">
                  <Checkbox
                    id={checkboxId}
                    checked={selectedSectionIdSet.has(section.id)}
                    onCheckedChange={(checked) => {
                      actions.setSectionSelection(section.id, checked === true);
                    }}
                  />
                  <Field.Content>
                    <SectionCardIdentity course={section.course} teachers={section.teachers} code={section.code} semester={{ nameCn: section.semester?.nameCn ?? section.semester?.namePrimary }} locale={data.locale}>
                      {#snippet title(summary)}
                        <Field.Label class="block w-full cursor-pointer break-words [overflow-wrap:anywhere]" for={checkboxId}>
                          <span class="sr-only">{formatCopy(welcomeCopy.selectSection, { code: section.code })} · </span>
                          {summary}
                        </Field.Label>
                      {/snippet}
                    </SectionCardIdentity>
                    {#if section.campus}<Field.Description>{displayWelcomeName(section.campus, data.locale)}</Field.Description>{/if}
                  </Field.Content>
                </Field.Field>
              {/each}
            </Field.Group>
          </Field.Set>
          <Button
            loading={state.isImporting}
            disabled={selectedCount === 0 || state.isImporting}
            onclick={actions.confirmImport}
          >
            {state.isImporting
              ? welcomeCopy.importing
              : formatCopy(welcomeCopy.subscribeSelected, { count: selectedCount })}
          </Button>
        {:else}
          <CollectionEmpty variant="compact" description={welcomeCopy.noMatchingSections} />
        {/if}
        {#if state.unmatchedCodes.length > 0}
          <Alert.Message heading={formatCopy(bulkCopy.unmatchedCodes, { count: state.unmatchedCodes.length })}>
            {state.unmatchedCodes.join(", ")}
          </Alert.Message>
        {/if}
      </div>
    {/if}
  </div>

  <footer class="flex flex-wrap justify-between gap-2">
    {#if data.backUrl}
      <Button icon={ArrowLeft} href={data.backUrl} variant="ghost">
        {welcomeCopy.back}
      </Button>
    {/if}
    <Button class="ms-auto" href={data.nextUrl} variant="secondary">
      {welcomeCopy.skipForNow}
      <ArrowRight data-icon="inline-end" />
    </Button>
  </footer>
</section>
