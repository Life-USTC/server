<script lang="ts">
import ArrowUpRight from "@lucide/svelte/icons/arrow-up-right";
import UserMinus from "@lucide/svelte/icons/user-minus";
import type {
  DashboardDashboardCopy,
  DashboardSectionCopy,
  DashboardSubscriptionsCopy,
  SubscriptionsData,
} from "@/features/dashboard/lib/dashboard-controller-types";
import { groupSubscribedSectionsBySemester } from "@/features/dashboard/lib/subscriptions";
import { page } from "$app/stores";
import TruncatedText from "$lib/components/TruncatedText.svelte";
import * as AlertDialog from "$lib/components/ui/alert-dialog/index.js";
import { Spinner } from "$lib/components/ui/spinner/index.js";
import * as Table from "$lib/components/ui/table/index.js";
import DashboardNoSubscriptionsState from "./DashboardNoSubscriptionsState.svelte";
import DashboardTableIconButton from "./DashboardTableIconButton.svelte";
import DashboardTableRowActions from "./DashboardTableRowActions.svelte";
import SubscriptionsCardsView from "./SubscriptionsCardsView.svelte";
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

let pendingRemoveSection: SubscriptionSection | null = null;
let removeDialogOpen = false;

$: locale = $page.data.locale ?? "zh-cn";
$: sectionGroups = subscriptions.flatMap((subscription) =>
  groupSubscribedSectionsBySemester(
    subscription.sections,
    dashboardCopy.notAvailable,
    locale,
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
  return section.course.namePrimary ?? dashboardCopy.notAvailable;
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

{#if subscriptions.length > 0}
  <div
    class="subscription-semester-groups grid min-w-0 gap-6"
    data-testid="subscription-semester-groups"
  >
    {#each sectionGroups as group}
      <section class="grid min-w-0 gap-3">
        <div class="flex flex-wrap items-center justify-between gap-2 text-sm">
          <h3 class="font-medium">
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
        <div class="md:hidden">
          <SubscriptionsCardsView
            {dashboardCopy}
            {requestRemoveSection}
            {removingSectionId}
            {sectionCopy}
            sections={group.sections}
            {subscriptionsCopy}
          />
        </div>
        <div class="hidden min-w-0 overflow-x-auto md:block">
          <Table.Root
            class="min-w-0 w-full"
            data-testid="subscription-semester-table"
          >
            <Table.Header>
              <Table.Row>
                <Table.Head>{subscriptionsCopy.courseName}</Table.Head>
                <Table.Head>{sectionCopy.teachers}</Table.Head>
                <Table.Head class="text-end">
                  {subscriptionsCopy.credits}
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
                    <a
                      class="block min-w-0 max-w-full overflow-hidden hover:underline"
                      href={`/catalog/sections/${section.jwId}`}
                      data-testid="subscription-course-link"
                    >
                      <TruncatedText text={courseName(section)} />
                    </a>
                  </Table.Cell>
                  <Table.Cell>
                    {teacherNames(section)}
                  </Table.Cell>
                  <Table.Cell class="text-end">
                    {section.credits ?? dashboardCopy.notAvailable}
                  </Table.Cell>
                  <Table.Cell>
                    <DashboardTableRowActions>
                      <DashboardTableIconButton
                        disabled={removingSectionId === section.id}
                        label={subscriptionsCopy.unsubscribe}
                        variant="destructive"
                        onclick={() => requestRemoveSection(section)}
                      >
                        {#if removingSectionId === section.id}
                          <Spinner />
                        {:else}
                          <UserMinus />
                        {/if}
                      </DashboardTableIconButton>
                      <DashboardTableIconButton
                        href={`/catalog/sections/${section.jwId}`}
                        label={sectionCopy.moreDetails}
                      >
                        <ArrowUpRight />
                      </DashboardTableIconButton>
                    </DashboardTableRowActions>
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
