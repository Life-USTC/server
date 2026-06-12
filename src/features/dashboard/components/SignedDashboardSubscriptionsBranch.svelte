<script lang="ts">
import SubscriptionsTab from "./SubscriptionsTab.svelte";
import type {
  DashboardSubscriptionsTabProps,
  FormatMessage,
  MatchedImportSection,
  NameFormatter,
} from "./subscription-tab-types";

export let bulkImportError: string;
export let bulkImportMessage: string;
export let bulkImportSemesterId: string;
export let bulkImportText: string;
export let canMatchImportSections: boolean;
export let confirmImportSections: DashboardSubscriptionsTabProps["confirmImportSections"];
export let copyCalendarLink: DashboardSubscriptionsTabProps["copyCalendarLink"];
export let dashboardCopy: DashboardSubscriptionsTabProps["dashboardCopy"];
export let formatMessage: FormatMessage;
export let isBulkImportOpen: boolean;
export let isConfirmImportOpen: boolean;
export let isImportingSections: boolean;
export let isMatchingSections: boolean;
export let matchedSections: MatchedImportSection[];
export let matchImportSections: DashboardSubscriptionsTabProps["matchImportSections"];
export let namePrimary: NameFormatter;
export let nameSecondary: NameFormatter;
export let openBulkImportDialog: DashboardSubscriptionsTabProps["openBulkImportDialog"];
export let pendingRemoveSectionId: DashboardSubscriptionsTabProps["pendingRemoveSectionId"];
export let removeSubscribedSection: DashboardSubscriptionsTabProps["removeSubscribedSection"];
export let removingSectionId: DashboardSubscriptionsTabProps["removingSectionId"];
export let resetBulkImport: DashboardSubscriptionsTabProps["resetBulkImport"];
export let sectionCopy: DashboardSubscriptionsTabProps["sectionCopy"];
export let selectedImportCount: number;
export let selectedImportSectionIdSet: Set<number>;
export let signedData: DashboardSubscriptionsTabProps["signedData"];
export let subscriptionActionError: string;
export let subscriptionActionMessage: string;
export let subscriptionsCopy: DashboardSubscriptionsTabProps["subscriptionsCopy"];
export let toggleImportSectionSelection: DashboardSubscriptionsTabProps["toggleImportSectionSelection"];
export let unmatchedSectionCodes: string[];
</script>

<SubscriptionsTab
  {dashboardCopy}
  {sectionCopy}
  {subscriptionsCopy}
  {signedData}
  {selectedImportSectionIdSet}
  {selectedImportCount}
  {canMatchImportSections}
  {formatMessage}
  {copyCalendarLink}
  {namePrimary}
  {nameSecondary}
  {resetBulkImport}
  {openBulkImportDialog}
  {toggleImportSectionSelection}
  {matchImportSections}
  {confirmImportSections}
  {removeSubscribedSection}
  {bulkImportMessage}
  {bulkImportError}
  {isMatchingSections}
  {isImportingSections}
  {pendingRemoveSectionId}
  {removingSectionId}
  {subscriptionActionMessage}
  {subscriptionActionError}
  {matchedSections}
  {unmatchedSectionCodes}
  bind:isBulkImportOpen
  bind:isConfirmImportOpen
  bind:bulkImportSemesterId
  bind:bulkImportText
/>
