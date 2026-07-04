<script lang="ts">
import { Checkbox } from "$lib/components/ui/checkbox/index.js";
import * as Field from "$lib/components/ui/field/index.js";
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
  <Field.Group data-slot="checkbox-group" class="gap-2">
    {#each matchedSections as section}
      {@const courseSecondaryName = nameSecondary(section.course)}
      {@const checkboxId = `subscription-import-section-${section.id}`}
      <Field.Field
        orientation="horizontal"
        class="rounded-md border border-base-300 bg-base-100 p-3 transition hover:bg-base-200"
      >
        <Checkbox
          id={checkboxId}
          checked={selectedImportSectionIdSet.has(section.id)}
          aria-label={formatMessage(subscriptionsCopy.bulkImport.selectSection, {
            code: section.code,
          })}
          onCheckedChange={() => {
            toggleImportSectionSelection(section.id);
          }}
        />
        <Field.Content>
          <Field.Label class="cursor-pointer font-normal" for={checkboxId}>
            {namePrimary(section.course)}
            {#if courseSecondaryName}
              <span class="text-base-content/60">({courseSecondaryName})</span>
            {/if}
          </Field.Label>
          <Field.Description>
            {section.code}
            {#if section.semester} · {namePrimary(section.semester)}{/if}
            {#if section.campus} · {namePrimary(section.campus)}{/if}
            {#if section.teachers.length > 0}
              · {section.teachers.map(namePrimary).filter(Boolean).join(", ")}
            {/if}
          </Field.Description>
        </Field.Content>
      </Field.Field>
    {/each}
  </Field.Group>
{:else}
  <p class="text-base-content/60 text-sm">{subscriptionsCopy.bulkImport.noMatches}</p>
{/if}
