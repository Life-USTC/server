<script lang="ts">
import SubscriptionsTab from "./SubscriptionsTab.svelte";
import type {
  FormatMessage,
  MatchedImportSection,
  NameFormatter,
  WorkspaceSubscriptionsTabProps,
} from "./subscription-tab-types";

export let bulkImportError: string;
export let bulkImportMessage: string;
export let bulkImportSemesterId: string;
export let bulkImportText: string;
export let canMatchImportSections: boolean;
export let confirmImportSections: WorkspaceSubscriptionsTabProps["confirmImportSections"];
export let workspaceCopy: WorkspaceSubscriptionsTabProps["workspaceCopy"];
export let formatMessage: FormatMessage;
export let isBulkImportOpen: boolean;
export let isConfirmImportOpen: boolean;
export let isImportingSections: boolean;
export let isMatchingSections: boolean;
export let matchedSections: MatchedImportSection[];
export let matchImportSections: WorkspaceSubscriptionsTabProps["matchImportSections"];
export let namePrimary: NameFormatter;
export let nameSecondary: NameFormatter;
export let openBulkImportDialog: WorkspaceSubscriptionsTabProps["openBulkImportDialog"];
export let removeSubscribedSection: WorkspaceSubscriptionsTabProps["removeSubscribedSection"];
export let removingSectionId: WorkspaceSubscriptionsTabProps["removingSectionId"];
export let resetBulkImport: WorkspaceSubscriptionsTabProps["resetBulkImport"];
export let searchQuickAddSections: WorkspaceSubscriptionsTabProps["searchQuickAddSections"];
export let sectionCopy: WorkspaceSubscriptionsTabProps["sectionCopy"];
export let selectedImportSectionIdSet: Set<number>;
export let signedData: WorkspaceSubscriptionsTabProps["signedData"];
export let subscriptionActionError: string;
export let subscribeQuickAddSections: WorkspaceSubscriptionsTabProps["subscribeQuickAddSections"];
export let subscriptionsCopy: WorkspaceSubscriptionsTabProps["subscriptionsCopy"];
export let toggleImportSectionSelection: WorkspaceSubscriptionsTabProps["toggleImportSectionSelection"];
export let unmatchedSectionCodes: string[];
</script>

<SubscriptionsTab
  {workspaceCopy}
  {sectionCopy}
  {subscriptionsCopy}
  {signedData}
  {selectedImportSectionIdSet}
  {canMatchImportSections}
  {formatMessage}
  {namePrimary}
  {nameSecondary}
  {resetBulkImport}
  {searchQuickAddSections}
  {openBulkImportDialog}
  {toggleImportSectionSelection}
  {matchImportSections}
  {confirmImportSections}
  {removeSubscribedSection}
  {bulkImportMessage}
  {bulkImportError}
  {isMatchingSections}
  {isImportingSections}
  {removingSectionId}
  {subscribeQuickAddSections}
  {subscriptionActionError}
  {matchedSections}
  {unmatchedSectionCodes}
  bind:isBulkImportOpen
  bind:isConfirmImportOpen
  bind:bulkImportSemesterId
  bind:bulkImportText
/>
