<script lang="ts">
import { Checkbox } from "$lib/components/ui/checkbox/index.js";
import * as Empty from "$lib/components/ui/empty/index.js";
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
  <Field.Set>
    <Field.Legend variant="label" class="sr-only">
      {subscriptionsCopy.bulkImport.title}
    </Field.Legend>
    <Field.Group data-slot="checkbox-group" class="gap-2">
      {#each matchedSections as section}
        {@const courseSecondaryName = nameSecondary(section.course)}
        {@const checkboxId = `subscription-import-section-${section.id}`}
        <Field.Field orientation="horizontal">
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
            <Field.Label class="cursor-pointer" for={checkboxId}>
              {namePrimary(section.course)}
              {#if courseSecondaryName}
                <span class="text-muted-foreground">({courseSecondaryName})</span>
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
  </Field.Set>
{:else}
  <Empty.Root class="min-h-20 p-4">
    <Empty.Header>
      <Empty.Description>{subscriptionsCopy.bulkImport.noMatches}</Empty.Description>
    </Empty.Header>
  </Empty.Root>
{/if}
