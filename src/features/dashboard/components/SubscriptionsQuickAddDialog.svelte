<script lang="ts">
import Search from "@lucide/svelte/icons/search";
import SearchX from "@lucide/svelte/icons/search-x";
import * as Alert from "$lib/components/ui/alert/index.js";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import { Checkbox } from "$lib/components/ui/checkbox/index.js";
import * as Dialog from "$lib/components/ui/dialog/index.js";
import * as Empty from "$lib/components/ui/empty/index.js";
import * as Field from "$lib/components/ui/field/index.js";
import * as InputGroup from "$lib/components/ui/input-group/index.js";
import * as Item from "$lib/components/ui/item/index.js";
import * as NativeSelect from "$lib/components/ui/native-select/index.js";
import { ScrollArea } from "$lib/components/ui/scroll-area/index.js";
import { Separator } from "$lib/components/ui/separator/index.js";
import { Spinner } from "$lib/components/ui/spinner/index.js";
import type {
  DashboardSubscriptionsTabProps,
  FormatMessage,
  MatchedImportSection,
  NameFormatter,
} from "./subscription-tab-types";

export let subscriptionsCopy: DashboardSubscriptionsTabProps["subscriptionsCopy"];
export let signedData: DashboardSubscriptionsTabProps["signedData"];
export let formatMessage: FormatMessage;
export let namePrimary: NameFormatter;
export let searchQuickAddSections: DashboardSubscriptionsTabProps["searchQuickAddSections"];
export let subscribeQuickAddSections: DashboardSubscriptionsTabProps["subscribeQuickAddSections"];
export let open: boolean;

let semesterId = "";
let query = "";
let results: MatchedImportSection[] = [];
let selectedSectionIds: number[] = [];
let error = "";
let hasSearched = false;
let isSearching = false;
let isSubmitting = false;
let searchedQuery = "";
let searchedSemesterId = "";
let searchGeneration = 0;

$: semesterOptions = signedData.subscriptions.semesters.map((semester) => ({
  value: String(semester.id),
  label: semester.nameCn,
}));
$: selectedSectionIdSet = new Set(selectedSectionIds);
$: subscribedSectionIdSet = new Set(
  signedData.subscriptions.subscriptions.flatMap((subscription) =>
    subscription.sections.map((section) => section.id),
  ),
);
$: canSearch = semesterId.length > 0 && query.trim().length > 0 && !isSearching;
$: if (open && !semesterId) {
  semesterId = String(
    signedData.subscriptions.currentSemesterId ??
      signedData.subscriptions.semesters[0]?.id ??
      "",
  );
}
$: if (
  hasSearched &&
  (query !== searchedQuery || semesterId !== searchedSemesterId)
) {
  resetSearchResults();
}

function resetSearchResults() {
  searchGeneration += 1;
  error = "";
  hasSearched = false;
  results = [];
  selectedSectionIds = [];
  searchedQuery = "";
  searchedSemesterId = "";
}

function resetDialog() {
  semesterId = String(
    signedData.subscriptions.currentSemesterId ??
      signedData.subscriptions.semesters[0]?.id ??
      "",
  );
  query = "";
  resetSearchResults();
  isSearching = false;
  isSubmitting = false;
}

function closeDialog() {
  resetDialog();
  open = false;
}

function toggleSection(sectionId: number) {
  selectedSectionIds = selectedSectionIdSet.has(sectionId)
    ? selectedSectionIds.filter((id) => id !== sectionId)
    : [...selectedSectionIds, sectionId];
}

async function searchSections() {
  if (!canSearch) return;
  const generation = ++searchGeneration;
  const requestedQuery = query;
  const requestedSemesterId = semesterId;
  error = "";
  isSearching = true;

  try {
    const result = await searchQuickAddSections({
      semesterId: requestedSemesterId,
      text: requestedQuery,
    });
    if (generation !== searchGeneration || !open) return;
    results = result.sections;
    selectedSectionIds = result.selectedSectionIds.filter(
      (sectionId) => !subscribedSectionIdSet.has(sectionId),
    );
    searchedQuery = requestedQuery;
    searchedSemesterId = requestedSemesterId;
    hasSearched = true;
  } catch (searchError) {
    if (generation !== searchGeneration || !open) return;
    error = searchError instanceof Error ? searchError.message : "";
    results = [];
    selectedSectionIds = [];
    hasSearched = false;
  } finally {
    if (generation === searchGeneration) isSearching = false;
  }
}

async function subscribeSelectedSections() {
  if (selectedSectionIds.length === 0 || isSubmitting) return;
  error = "";
  isSubmitting = true;

  try {
    await subscribeQuickAddSections(selectedSectionIds);
    closeDialog();
  } catch (subscribeError) {
    error = subscribeError instanceof Error ? subscribeError.message : "";
  } finally {
    isSubmitting = false;
  }
}
</script>

{#if open}
  <Dialog.Root
    open={true}
    onOpenChange={(nextOpen) => {
      if (!nextOpen) closeDialog();
    }}
  >
    <Dialog.Content class="max-w-lg sm:max-w-lg">
      <Dialog.Header>
        <Dialog.Title>{subscriptionsCopy.quickAdd.title}</Dialog.Title>
        <Dialog.Description>
          {subscriptionsCopy.quickAdd.description}
        </Dialog.Description>
      </Dialog.Header>

      <Field.Group class="gap-4 px-5 py-4">
        {#if error}
          <Alert.Root variant="destructive">
            <Alert.Description>{error}</Alert.Description>
          </Alert.Root>
        {/if}

        <Field.Field>
          <Field.Label for="subscriptions-quick-add-semester">
            {subscriptionsCopy.bulkImport.semesterLabel}
          </Field.Label>
          <NativeSelect.Root
            bind:value={semesterId}
            class="w-full"
            id="subscriptions-quick-add-semester"
          >
            {#each semesterOptions as option}
              <NativeSelect.Option value={option.value}>
                {option.label}
              </NativeSelect.Option>
            {/each}
          </NativeSelect.Root>
        </Field.Field>

        <Field.Field>
          <Field.Label for="subscriptions-quick-add-code">
            {subscriptionsCopy.quickAdd.codeLabel}
          </Field.Label>
          <InputGroup.Root>
            <InputGroup.Input
              id="subscriptions-quick-add-code"
              bind:value={query}
              placeholder={subscriptionsCopy.quickAdd.placeholder}
              onkeydown={(event) => {
                if (event.key === "Enter" && canSearch) {
                  event.preventDefault();
                  void searchSections();
                }
              }}
            />
            <InputGroup.Addon align="inline-end">
              <Button
                disabled={!canSearch}
                size="xs"
                type="button"
                variant="ghost"
                onclick={searchSections}
              >
                {#if isSearching}
                  <Spinner data-icon="inline-start" />
                {:else}
                  <Search data-icon="inline-start" />
                {/if}
                {isSearching
                  ? subscriptionsCopy.quickAdd.searching
                  : subscriptionsCopy.quickAdd.searchButton}
              </Button>
            </InputGroup.Addon>
          </InputGroup.Root>
          <Field.Description>
            {subscriptionsCopy.quickAdd.hint}
          </Field.Description>
        </Field.Field>
      </Field.Group>

      {#if hasSearched}
        <Separator />
        <ScrollArea class="h-[min(42vh,20rem)]">
          <div class="px-5 py-4">
            {#if results.length > 0}
              <Field.Set>
                <Field.Legend variant="label">
                  {formatMessage(subscriptionsCopy.quickAdd.resultsLabel, {
                    count: results.length,
                  })}
                </Field.Legend>
                <Field.Description>
                  {subscriptionsCopy.quickAdd.resultsDescription}
                </Field.Description>
                <Item.Group class="mt-3">
                  {#each results as section}
                    <Item.Root variant="outline">
                      <Item.Media>
                        <Checkbox
                          checked={subscribedSectionIdSet.has(section.id) ||
                            selectedSectionIdSet.has(section.id)}
                          disabled={subscribedSectionIdSet.has(section.id)}
                          aria-label={formatMessage(
                            subscriptionsCopy.quickAdd.selectSection,
                            { code: section.code },
                          )}
                          onCheckedChange={() => toggleSection(section.id)}
                        />
                      </Item.Media>
                      <Item.Content>
                        <Item.Title>
                          {namePrimary(section.course)}
                        </Item.Title>
                        <Item.Description>
                          {section.code}
                          {#if section.campus}
                            · {namePrimary(section.campus)}
                          {/if}
                          {#if section.teachers.length > 0}
                            · {section.teachers
                              .map(namePrimary)
                              .filter(Boolean)
                              .join(", ")}
                          {/if}
                        </Item.Description>
                      </Item.Content>
                      {#if subscribedSectionIdSet.has(section.id)}
                        <Item.Actions>
                          <Badge variant="secondary">
                            {subscriptionsCopy.quickAdd.alreadySubscribed}
                          </Badge>
                        </Item.Actions>
                      {/if}
                    </Item.Root>
                  {/each}
                </Item.Group>
              </Field.Set>
            {:else}
              <Empty.Root class="min-h-32 p-4">
                <Empty.Header>
                  <Empty.Media variant="icon">
                    <SearchX />
                  </Empty.Media>
                  <Empty.Title>{subscriptionsCopy.quickAdd.emptyTitle}</Empty.Title>
                  <Empty.Description>
                    {subscriptionsCopy.quickAdd.emptyDescription}
                  </Empty.Description>
                </Empty.Header>
              </Empty.Root>
            {/if}
          </div>
        </ScrollArea>
      {/if}

      <Dialog.Footer>
        <Button type="button" variant="outline" onclick={closeDialog}>
          {subscriptionsCopy.quickAdd.cancel}
        </Button>
        <Button
          disabled={selectedSectionIds.length === 0 || isSubmitting}
          type="button"
          onclick={subscribeSelectedSections}
        >
          {#if isSubmitting}
            <Spinner data-icon="inline-start" />
          {/if}
          {isSubmitting
            ? subscriptionsCopy.quickAdd.subscribing
            : formatMessage(subscriptionsCopy.quickAdd.subscribeSelected, {
                count: selectedSectionIds.length,
              })}
        </Button>
      </Dialog.Footer>
    </Dialog.Content>
  </Dialog.Root>
{/if}
