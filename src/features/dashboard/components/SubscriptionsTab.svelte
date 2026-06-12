<script lang="ts">
import SubscriptionsBulkImportConfirmDialog from "./SubscriptionsBulkImportConfirmDialog.svelte";
import SubscriptionsBulkImportDialog from "./SubscriptionsBulkImportDialog.svelte";
import SubscriptionsList from "./SubscriptionsList.svelte";
import SubscriptionsStatusAlerts from "./SubscriptionsStatusAlerts.svelte";
import SubscriptionsTabToolbar from "./SubscriptionsTabToolbar.svelte";
import type {
  DashboardSubscriptionsTabProps,
  FormatMessage,
  MatchedImportSection,
  NameFormatter,
} from "./subscription-tab-types";

export let dashboardCopy: DashboardSubscriptionsTabProps["dashboardCopy"];
export let sectionCopy: DashboardSubscriptionsTabProps["sectionCopy"];
export let subscriptionsCopy: DashboardSubscriptionsTabProps["subscriptionsCopy"];
export let signedData: DashboardSubscriptionsTabProps["signedData"];

export let selectedImportSectionIdSet: Set<number>;
export let selectedImportCount: number;
export let canMatchImportSections: boolean;
export let formatMessage: FormatMessage;
export let copyCalendarLink: DashboardSubscriptionsTabProps["copyCalendarLink"];
export let namePrimary: NameFormatter;
export let nameSecondary: NameFormatter;
export let resetBulkImport: DashboardSubscriptionsTabProps["resetBulkImport"];
export let openBulkImportDialog: DashboardSubscriptionsTabProps["openBulkImportDialog"];
export let toggleImportSectionSelection: DashboardSubscriptionsTabProps["toggleImportSectionSelection"];
export let matchImportSections: DashboardSubscriptionsTabProps["matchImportSections"];
export let confirmImportSections: DashboardSubscriptionsTabProps["confirmImportSections"];
export let removeSubscribedSection: DashboardSubscriptionsTabProps["removeSubscribedSection"];

export let isBulkImportOpen: boolean;
export let isConfirmImportOpen: boolean;
export let bulkImportSemesterId: string;
export let bulkImportText: string;
export let bulkImportMessage: string;
export let bulkImportError: string;
export let isMatchingSections: boolean;
export let isImportingSections: boolean;
export let pendingRemoveSectionId: DashboardSubscriptionsTabProps["pendingRemoveSectionId"];
export let removingSectionId: DashboardSubscriptionsTabProps["removingSectionId"];
export let subscriptionActionMessage: string;
export let subscriptionActionError: string;
export let matchedSections: MatchedImportSection[];
export let unmatchedSectionCodes: string[];
</script>

<section class="grid min-w-0 gap-4">
  <SubscriptionsTabToolbar
    calendarSubscriptionUrl={signedData.subscriptions.calendarSubscriptionUrl ?? null}
    {copyCalendarLink}
    {openBulkImportDialog}
    {subscriptionsCopy}
  />

  <SubscriptionsStatusAlerts
    {bulkImportError}
    {bulkImportMessage}
    {subscriptionActionError}
    {subscriptionActionMessage}
  />

  <SubscriptionsList
    {dashboardCopy}
    {formatMessage}
    {pendingRemoveSectionId}
    {removeSubscribedSection}
    {removingSectionId}
    {sectionCopy}
    subscriptions={signedData.subscriptions.subscriptions}
    {subscriptionsCopy}
  />

  <SubscriptionsBulkImportDialog
    bind:bulkImportSemesterId
    bind:bulkImportText
    bind:isBulkImportOpen
    {bulkImportError}
    {canMatchImportSections}
    {isMatchingSections}
    {matchImportSections}
    {resetBulkImport}
    {signedData}
    {subscriptionsCopy}
  />

  <SubscriptionsBulkImportConfirmDialog
    bind:isConfirmImportOpen
    {confirmImportSections}
    {formatMessage}
    {isImportingSections}
    {matchedSections}
    {namePrimary}
    {nameSecondary}
    {selectedImportCount}
    {selectedImportSectionIdSet}
    {subscriptionsCopy}
    {toggleImportSectionSelection}
    {unmatchedSectionCodes}
  />
</section>
