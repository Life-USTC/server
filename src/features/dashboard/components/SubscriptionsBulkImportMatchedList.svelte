<script lang="ts">
import type {
  DashboardSubscriptionsTabProps,
  FormatMessage,
  MatchedImportSection,
  NameFormatter,
} from "./subscription-tab-types";

export let formatMessage: FormatMessage;
export let matchedSections: MatchedImportSection[];
export let namePrimary: NameFormatter;
export let nameSecondary: NameFormatter;
export let selectedImportSectionIdSet: Set<number>;
export let subscriptionsCopy: DashboardSubscriptionsTabProps["subscriptionsCopy"];
export let toggleImportSectionSelection: (sectionId: number) => void;
</script>

{#if matchedSections.length > 0}
  <div class="grid gap-2">
    {#each matchedSections as section}
      {@const courseSecondaryName = nameSecondary(section.course)}
      <button
        class="flex w-full cursor-pointer items-start gap-3 rounded-md border border-base-300 bg-base-100 p-3 text-left transition hover:bg-base-200"
        type="button"
        aria-label={formatMessage(subscriptionsCopy.bulkImport.selectSection, {
          code: section.code,
        })}
        onclick={() => {
          toggleImportSectionSelection(section.id);
        }}
      >
        <span
          class={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${selectedImportSectionIdSet.has(section.id) ? "border-primary bg-primary" : "border-base-300 bg-base-100"}`}
          aria-hidden="true"
        >
          {#if selectedImportSectionIdSet.has(section.id)}
            <span class="h-2 w-2 rounded-[2px] bg-primary-content"></span>
          {/if}
        </span>
        <span class="min-w-0 flex-1">
          <span class="block font-medium">
            {namePrimary(section.course)}
            {#if courseSecondaryName}
              <span class="text-base-content/60">({courseSecondaryName})</span>
            {/if}
          </span>
          <span class="block text-base-content/60 text-sm">
            {section.code}
            {#if section.semester} · {namePrimary(section.semester)}{/if}
            {#if section.campus} · {namePrimary(section.campus)}{/if}
            {#if section.teachers.length > 0}
              · {section.teachers.map(namePrimary).filter(Boolean).join(", ")}
            {/if}
          </span>
        </span>
      </button>
    {/each}
  </div>
{:else}
  <p class="text-base-content/60 text-sm">{subscriptionsCopy.bulkImport.noMatches}</p>
{/if}
