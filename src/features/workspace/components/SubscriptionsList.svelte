<script lang="ts">
import ArrowUpRight from "@lucide/svelte/icons/arrow-up-right";
import Pencil from "@lucide/svelte/icons/pencil";
import UserMinus from "@lucide/svelte/icons/user-minus";
import CollectionEmpty from "#lib/components/CollectionEmpty.svelte";
import ResponsiveCollection from "#lib/components/ResponsiveCollection.svelte";
import TableFieldFilter from "#lib/components/TableFieldFilter.svelte";
import TableIconButton from "#lib/components/TableIconButton.svelte";
import TableRowActions from "#lib/components/TableRowActions.svelte";
import TruncatedText from "#lib/components/TruncatedText.svelte";
import * as AlertDialog from "#lib/components/ui/alert-dialog/index.js";
import { Badge } from "#lib/components/ui/badge/index.js";
import { Button } from "#lib/components/ui/button/index.js";
import { Spinner } from "#lib/components/ui/spinner/index.js";
import * as Table from "#lib/components/ui/table/index.js";
import WorkspaceCollection from "#lib/components/WorkspaceCollection.svelte";
import { groupSubscribedSectionsBySemester } from "@/features/workspace/lib/subscriptions";
import type {
  SubscriptionsData,
  WorkspaceCopy,
  WorkspaceSectionCopy,
  WorkspaceSubscriptionsCopy,
} from "@/features/workspace/lib/workspace-controller-types";
import { getWorkspacePageCopy } from "@/lib/shell/page-copy";
import { matchTableFilter, type TableFilterField } from "@/lib/table-filters";
import { page as routePage } from "$app/state";
import SubscriptionKindDialog from "./SubscriptionKindDialog.svelte";
import SubscriptionsCardsView from "./SubscriptionsCardsView.svelte";
import type { FormatMessage } from "./subscription-tab-types";
import WorkspaceNoSubscriptionsState from "./WorkspaceNoSubscriptionsState.svelte";

type SubscriptionListData = SubscriptionsData["subscriptions"];
type SubscriptionSection = SubscriptionListData[number]["sections"][number];

interface Props {
  workspaceCopy: WorkspaceCopy;
  formatMessage: FormatMessage;
  removeSubscribedSection: (
    sectionId: SubscriptionSection["id"],
  ) => boolean | Promise<boolean>;
  removingSectionId: SubscriptionSection["id"] | null;
  sectionCopy: WorkspaceSectionCopy;
  subscriptions: SubscriptionListData;
  subscriptionsCopy: WorkspaceSubscriptionsCopy;
  openBulkImportDialog: () => void;
  openQuickAddDialog: () => void;
}

let {
  workspaceCopy,
  formatMessage,
  removeSubscribedSection,
  removingSectionId,
  sectionCopy,
  subscriptions,
  subscriptionsCopy,
  openBulkImportDialog,
  openQuickAddDialog,
}: Props = $props();

let editingSection: SubscriptionSection | null = $state(null);

function requestEditKind(section: SubscriptionSection) {
  editingSection = section;
}

let pendingRemoveSection: SubscriptionSection | null = $state(null);
let removeDialogOpen = $state(false);

let locale = $derived(routePage.data.locale ?? "zh-cn");
const common = $derived(
  getWorkspacePageCopy(locale === "en-us" ? "en-us" : "zh-cn").common,
);
let draft = $state<Record<string, string>>({});
let applied = $state<Record<string, string>>({});
const allSections = $derived(
  subscriptions.flatMap((subscription) => subscription.sections),
);
const columns = $derived<TableFilterField[][]>([
  [
    { name: "course", label: subscriptionsCopy.courseName },
    { name: "code", label: subscriptionsCopy.section },
    {
      name: "kind",
      label: subscriptionsCopy.kindEditor.title,
      options: ["regular", "auditor", "teaching_assistant"].map((value) => ({
        value,
        label:
          subscriptionsCopy.kindEditor[
            value as "regular" | "auditor" | "teaching_assistant"
          ],
      })),
    },
  ],
  [
    {
      name: "teacher",
      label: String(sectionCopy.teachers),
      options: [
        ...new Set(
          allSections.flatMap((section) =>
            section.teachers
              .map((teacher) => teacher.namePrimary)
              .filter((name): name is string => Boolean(name)),
          ),
        ),
      ].map((value) => ({ value: encodeURIComponent(value), label: value })),
    },
  ],
  [
    {
      name: "credits",
      label: subscriptionsCopy.credits,
      type: "number",
      min: 0,
      step: 0.5,
    },
  ],
]);
const semesterField = $derived<TableFilterField>({
  name: "semester",
  label: subscriptionsCopy.semester,
  options: groupSubscribedSectionsBySemester(
    allSections,
    workspaceCopy.notAvailable,
    locale,
  ).map((group) => ({ value: group.key, label: group.label })),
});
function change(patch: Record<string, string>) {
  draft = { ...draft, ...patch };
}
function apply(event: SubmitEvent) {
  event.preventDefault();
  applied = { ...draft };
}
function matches(section: SubscriptionSection) {
  const values = {
    course: courseName(section),
    code: section.code,
    kind: section.kind,
    teacher: section.teachers.map((teacher) =>
      teacher.namePrimary ? encodeURIComponent(teacher.namePrimary) : "",
    ),
    credits: section.credits,
    semester: String(section.semester?.id ?? "unknown"),
  };
  return [...columns.flat(), semesterField].every((field) =>
    matchTableFilter(values[field.name as keyof typeof values], field, applied),
  );
}
let sectionGroups = $derived(
  subscriptions.flatMap((subscription) =>
    groupSubscribedSectionsBySemester(
      subscription.sections.filter(matches),
      workspaceCopy.notAvailable,
      locale,
    ),
  ),
);

function teacherNames(section: SubscriptionSection) {
  return (
    section.teachers
      .map((teacher) => teacher.namePrimary)
      .filter(Boolean)
      .join(", ") || sectionCopy.noTeachersListed
  );
}

function courseName(section: SubscriptionSection) {
  return section.course.namePrimary ?? workspaceCopy.notAvailable;
}

function requestRemoveSection(section: SubscriptionSection) {
  pendingRemoveSection = section;
  removeDialogOpen = true;
}

async function confirmRemoveSection() {
  if (!pendingRemoveSection) return;
  const section = pendingRemoveSection;
  removeDialogOpen = false;
  pendingRemoveSection = null;

  const removed = await removeSubscribedSection(section.id);
  if (!removed) {
    pendingRemoveSection = section;
    removeDialogOpen = true;
  }
}

function handleRemoveDialogOpenChange(open: boolean) {
  removeDialogOpen = open;
  if (!open && removingSectionId === null) pendingRemoveSection = null;
}
</script>

{#snippet column(index: number, suffix: string)}
  <TableFieldFilter label={columns[index][0].label} fields={columns[index]} values={draft} onchange={change} labels={common.tableFilters} idPrefix={`subscriptions-${suffix}-${index}`} formId="subscriptions-filters" />
{/snippet}


{#if subscriptions.length > 0}
  <form id="subscriptions-filters" onsubmit={apply} class="flex flex-wrap items-end gap-3">
    <TableFieldFilter label={semesterField.label} fields={[semesterField]} values={draft} onchange={change} labels={common.tableFilters} idPrefix="subscriptions-extra" formId="subscriptions-filters" />
    <Button type="submit">{common.applyFilters}</Button>
  </form>
  <ResponsiveCollection>
    {#snippet mobile()}
      <div class="flex flex-wrap gap-3" data-slot="collection-header">{#each columns as _, index}{@render column(index, "mobile")}{/each}</div>
    {/snippet}
    {#snippet desktop()}
      {#if sectionGroups.length === 0}
        <div class="flex flex-wrap gap-3" data-slot="collection-header">{#each columns as _, index}{@render column(index, "empty")}{/each}</div>
      {/if}
    {/snippet}
  </ResponsiveCollection>
  {#if sectionGroups.length === 0}<CollectionEmpty variant="compact" description={subscriptionsCopy.noSubscriptions} />{/if}
  <div
    class="subscription-semester-groups grid min-w-0 gap-6"
    data-testid="subscription-semester-groups"
  >
    {#each sectionGroups as group}
      <section class="grid min-w-0 gap-3">
        <div class="flex flex-wrap items-center justify-between gap-2 text-sm">
          <h3 class="font-medium text-muted-foreground">
            {formatMessage(subscriptionsCopy.semesterGroup, {
              name: group.label,
            })}
          </h3>
          <span class="text-muted-foreground">
            {formatMessage(
              group.sections.length === 1
                ? subscriptionsCopy.sectionIncluded
                : subscriptionsCopy.sectionsIncluded,
              {
                count: group.sections.length,
              },
            )}
          </span>
        </div>
        <WorkspaceCollection>
          {#snippet mobile()}
            <SubscriptionsCardsView
              workspaceCopy={workspaceCopy}
              requestRemoveSection={requestRemoveSection}
              requestEditKind={requestEditKind}
              removingSectionId={removingSectionId}
              sectionCopy={sectionCopy}
              sections={group.sections}
              subscriptionsCopy={subscriptionsCopy}
            />
          {/snippet}
          {#snippet desktop()}
          <Table.Root
            class="min-w-0 w-full"
            data-testid="subscription-semester-table"
          >
            <Table.Header>
              <Table.Row>
                <Table.Head>{@render column(0, group.key)}</Table.Head>
                <Table.Head>{@render column(1, group.key)}</Table.Head>
                <Table.Head class="text-left">
                  {@render column(2, group.key)}
                </Table.Head>
                <Table.Head>
                  <span class="sr-only">{sectionCopy.moreDetails}</span>
                </Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {#each group.sections as section}
                <Table.Row class="group">
                  <Table.Cell>
                    <div class="flex min-w-0 flex-wrap items-center gap-1.5">
                      <a
                        class="block min-w-0 max-w-full overflow-hidden py-0.5 font-medium hover:underline"
                        href={`/catalog/sections/${section.jwId}`}
                        data-testid="subscription-course-link"
                    >
                      <TruncatedText text={courseName(section)} />
                    </a>
                      {#if section.kind !== "regular"}
                        <Badge variant="secondary">{subscriptionsCopy.kindEditor[section.kind]}</Badge>
                      {/if}
                    </div>
                    <p class="text-muted-foreground font-mono text-xs break-words">
                      {section.code}
                    </p>
                  </Table.Cell>

                  <Table.Cell>{teacherNames(section)}</Table.Cell>
                  <Table.Cell class="text-left">{section.credits ?? workspaceCopy.notAvailable}</Table.Cell>

                  <Table.Cell>
                    <TableRowActions>
                      <TableIconButton
                        label={subscriptionsCopy.kindEditor.title}
                        onclick={() => requestEditKind(section)}
                      ><Pencil data-icon="inline-start" /></TableIconButton>

                      <TableIconButton
                        disabled={removingSectionId === section.id}
                        label={subscriptionsCopy.unsubscribe}
                        variant="destructive"
                        onclick={() => requestRemoveSection(section)}
                      >
                        {#if removingSectionId === section.id}
                          <Spinner data-icon="inline-start" />
                        {:else}
                          <UserMinus data-icon="inline-start" />
                        {/if}
                      </TableIconButton>
                      <TableIconButton
                        href={`/catalog/sections/${section.jwId}`}
                        label={sectionCopy.moreDetails}
                      >
                        <ArrowUpRight data-icon="inline-start" />
                      </TableIconButton>
                    </TableRowActions>
                  </Table.Cell>
                </Table.Row>
              {/each}
            </Table.Body>
          </Table.Root>
          {/snippet}
        </WorkspaceCollection>
      </section>
    {/each}
  </div>
{:else}
  <WorkspaceNoSubscriptionsState
    title={subscriptionsCopy.noSubscriptions}
    description={subscriptionsCopy.noSubscriptionsDescription}
    actions={[
      {
        label: subscriptionsCopy.quickAdd.title,
        onclick: openQuickAddDialog
      },

      {
        label: subscriptionsCopy.bulkImport.title,
        onclick: openBulkImportDialog,
        variant: "outline",
      },
      {
        href: "/catalog/sections",
        label: subscriptionsCopy.browseSections,
        variant: "outline",
      },
      {
        href: "/catalog/courses",
        label: subscriptionsCopy.browseCourses,
        variant: "ghost",
      },
    ]}
  />
{/if}

<AlertDialog.Root
  bind:open={removeDialogOpen}
  onOpenChange={handleRemoveDialogOpenChange}
>
  {#if pendingRemoveSection}
    <AlertDialog.Content>
      <AlertDialog.Header>
        <AlertDialog.Title>{subscriptionsCopy.unsubscribeTitle}</AlertDialog.Title>
        <AlertDialog.Description>
          {formatMessage(subscriptionsCopy.unsubscribeDescription, {
            name: courseName(pendingRemoveSection),
          })}
        </AlertDialog.Description>
      </AlertDialog.Header>
      <AlertDialog.Footer>
        <AlertDialog.Cancel>{subscriptionsCopy.cancelUnsubscribe}</AlertDialog.Cancel>
        <AlertDialog.Action
          variant="destructive"
          disabled={removingSectionId === pendingRemoveSection.id}
          onclick={confirmRemoveSection}
        >
          {#if removingSectionId === pendingRemoveSection.id}
            <Spinner data-icon="inline-start" />
          {/if}
          {subscriptionsCopy.confirmUnsubscribe}
        </AlertDialog.Action>
      </AlertDialog.Footer>
    </AlertDialog.Content>
  {/if}
</AlertDialog.Root>

{#if editingSection}
  <SubscriptionKindDialog section={editingSection} copy={subscriptionsCopy.kindEditor} onClose={() => { editingSection = null; }} />
{/if}
