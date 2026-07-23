<script lang="ts">
import type {
  DashboardDashboardCopy,
  DashboardSectionCopy,
  DashboardSubscriptionsCopy,
  SubscriptionsData,
} from "@/features/dashboard/lib/dashboard-controller-types";
import { groupSubscribedSectionsBySemester } from "@/features/dashboard/lib/subscriptions";
import * as AlertDialog from "$lib/components/ui/alert-dialog/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Dialog from "$lib/components/ui/dialog/index.js";
import { Spinner } from "$lib/components/ui/spinner/index.js";
import * as Table from "$lib/components/ui/table/index.js";
import DashboardNoSubscriptionsState from "./DashboardNoSubscriptionsState.svelte";
import type { FormatMessage } from "./subscription-tab-types";

type SubscriptionListData = SubscriptionsData["subscriptions"];
type SubscriptionSection = SubscriptionListData[number]["sections"][number];

export let dashboardCopy: DashboardDashboardCopy;
export let formatMessage: FormatMessage;
export let removeSubscribedSection: (
  sectionId: SubscriptionSection["id"],
) => boolean | Promise<boolean>;
export let removingSectionId: SubscriptionSection["id"] | null;
export let sectionCopy: DashboardSectionCopy;
export let subscriptions: SubscriptionListData;
export let subscriptionsCopy: DashboardSubscriptionsCopy;
export let openBulkImportDialog: () => void;
export let openQuickAddDialog: () => void;

let selectedSection: SubscriptionSection | null = null;
let removeConfirmOpen = false;

$: sectionGroups = subscriptions.flatMap((subscription) =>
  groupSubscribedSectionsBySemester(
    subscription.sections,
    dashboardCopy.notAvailable,
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

function openSectionDetails(section: SubscriptionSection) {
  selectedSection = section;
}

function handleRowKeydown(event: KeyboardEvent, section: SubscriptionSection) {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  openSectionDetails(section);
}

async function confirmRemoveSection() {
  if (!selectedSection) return;
  const removed = await removeSubscribedSection(selectedSection.id);
  if (removed) {
    removeConfirmOpen = false;
    selectedSection = null;
  }
}
</script>

{#if subscriptions.length > 0}
  <div
    class="subscription-semester-groups grid min-w-0 gap-4 2xl:grid-cols-2 2xl:items-start"
    data-testid="subscription-semester-groups"
  >
    {#each sectionGroups as group}
      <section class="grid min-w-0 gap-2">
        <div class="flex flex-wrap items-center justify-between gap-2 text-sm">
          <h3 class="font-medium">
            {formatMessage(subscriptionsCopy.semesterGroup, {
              name: group.label,
            })}
          </h3>
          <span class="text-muted-foreground">
            {formatMessage(group.sections.length === 1
              ? subscriptionsCopy.sectionIncluded
              : subscriptionsCopy.sectionsIncluded, {
              count: group.sections.length,
            })}
          </span>
        </div>
        <div class="min-w-0 overflow-hidden rounded-lg border">
          <Table.Root class="table-fixed">
            <Table.Header>
              <Table.Row>
                <Table.Head class="w-28">{subscriptionsCopy.section}</Table.Head>
                <Table.Head class="hidden md:table-cell">
                  {subscriptionsCopy.courseName}
                </Table.Head>
                <Table.Head class="hidden lg:table-cell">
                  {sectionCopy.teachers}
                </Table.Head>
                <Table.Head class="w-20 text-end">
                  {subscriptionsCopy.credits}
                </Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
          {#each group.sections as section}
            <Table.Row
              class="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
              role="button"
              tabindex={0}
              aria-label={formatMessage(subscriptionsCopy.openDetails, {
                code: String(section.code),
              })}
              onclick={() => openSectionDetails(section)}
              onkeydown={(event) => handleRowKeydown(event, section)}
            >
              <Table.Cell class="min-w-0 overflow-hidden align-top">
                <div class="truncate font-medium">{section.code}</div>
                <div class="mt-1 truncate text-sm md:hidden">
                  {section.course.namePrimary ?? dashboardCopy.notAvailable}
                </div>
                <div class="mt-1 truncate text-xs text-muted-foreground lg:hidden">
                  {teacherNames(section)}
                </div>
              </Table.Cell>
              <Table.Cell class="hidden min-w-0 overflow-hidden align-top md:table-cell">
                <div class="truncate">
                  {section.course.namePrimary ?? dashboardCopy.notAvailable}
                </div>
              </Table.Cell>
              <Table.Cell class="hidden min-w-0 overflow-hidden align-top lg:table-cell">
                <div class="truncate">{teacherNames(section)}</div>
              </Table.Cell>
              <Table.Cell class="w-20 text-end align-top">
                {section.credits ?? dashboardCopy.notAvailable}
              </Table.Cell>
            </Table.Row>
          {/each}
            </Table.Body>
          </Table.Root>
        </div>
      </section>
    {/each}
  </div>
{:else}
  <DashboardNoSubscriptionsState
    title={subscriptionsCopy.noSubscriptions}
    description={subscriptionsCopy.noSubscriptionsDescription}
    actions={[
      { label: subscriptionsCopy.quickAdd.title, onclick: openQuickAddDialog },
      { label: subscriptionsCopy.bulkImport.title, onclick: openBulkImportDialog, variant: "outline" },
      { href: "/sections", label: subscriptionsCopy.browseSections, variant: "outline" },
      { href: "/courses", label: subscriptionsCopy.browseCourses, variant: "ghost" },
    ]}
  />
{/if}

<style>
@media (min-width: 96rem) {
  @supports (display: grid-lanes) {
    .subscription-semester-groups {
      display: grid-lanes;
    }
  }
}
</style>

<Dialog.Root
  open={selectedSection !== null}
  onOpenChange={(open) => {
    if (!open && !removeConfirmOpen) selectedSection = null;
  }}
>
  {#if selectedSection}
    <Dialog.Content class="max-w-lg sm:max-w-lg">
      <Dialog.Header>
        <Dialog.Title class="break-words">
          {selectedSection.course.namePrimary ?? dashboardCopy.notAvailable}
        </Dialog.Title>
        <Dialog.Description>
          {formatMessage(subscriptionsCopy.detailsDescription, {
            code: String(selectedSection.code),
          })}
        </Dialog.Description>
      </Dialog.Header>

      <dl class="grid gap-4 px-5 py-4 sm:grid-cols-2">
        <div class="grid gap-1">
          <dt class="text-sm text-muted-foreground">{subscriptionsCopy.section}</dt>
          <dd class="font-medium">{selectedSection.code}</dd>
        </div>
        <div class="grid gap-1">
          <dt class="text-sm text-muted-foreground">{subscriptionsCopy.semester}</dt>
          <dd class="font-medium">
            {selectedSection.semester?.nameCn ?? dashboardCopy.notAvailable}
          </dd>
        </div>
        <div class="grid gap-1">
          <dt class="text-sm text-muted-foreground">{sectionCopy.teachers}</dt>
          <dd class="break-words font-medium">{teacherNames(selectedSection)}</dd>
        </div>
        <div class="grid gap-1">
          <dt class="text-sm text-muted-foreground">{subscriptionsCopy.credits}</dt>
          <dd class="font-medium">
            {selectedSection.credits ?? dashboardCopy.notAvailable}
          </dd>
        </div>
      </dl>

      <Dialog.Footer class="sm:justify-between">
        <Button
          disabled={removingSectionId === selectedSection.id}
          type="button"
          variant="destructive"
          onclick={() => (removeConfirmOpen = true)}
        >
          {#if removingSectionId === selectedSection.id}
            <Spinner data-icon="inline-start" />
          {/if}
          {subscriptionsCopy.unsubscribe}
        </Button>
        <div class="flex flex-col-reverse gap-2 sm:flex-row">
          <Button type="button" variant="outline" onclick={() => (selectedSection = null)}>
            {subscriptionsCopy.closeDetails}
          </Button>
          {#if selectedSection.course.jwId}
            <Button href={`/courses/${selectedSection.course.jwId}`}>
              {subscriptionsCopy.openCourse}
            </Button>
          {/if}
        </div>
      </Dialog.Footer>
    </Dialog.Content>
  {/if}
</Dialog.Root>

<AlertDialog.Root bind:open={removeConfirmOpen}>
  {#if selectedSection}
    <AlertDialog.Content>
      <AlertDialog.Header>
        <AlertDialog.Title>{subscriptionsCopy.unsubscribeTitle}</AlertDialog.Title>
        <AlertDialog.Description>
          {formatMessage(subscriptionsCopy.unsubscribeDescription, {
            code: String(selectedSection.code),
          })}
        </AlertDialog.Description>
      </AlertDialog.Header>
      <AlertDialog.Footer>
        <AlertDialog.Cancel>{subscriptionsCopy.cancelUnsubscribe}</AlertDialog.Cancel>
        <AlertDialog.Action
          variant="destructive"
          disabled={removingSectionId === selectedSection.id}
          onclick={confirmRemoveSection}
        >
          {#if removingSectionId === selectedSection.id}
            <Spinner data-icon="inline-start" />
          {/if}
          {subscriptionsCopy.confirmUnsubscribe}
        </AlertDialog.Action>
      </AlertDialog.Footer>
    </AlertDialog.Content>
  {/if}
</AlertDialog.Root>
