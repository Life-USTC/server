<script lang="ts">
import BulkImportConfirmDialog from "@/features/subscriptions/components/BulkImportConfirmDialog.svelte";
import BulkImportDialog from "@/features/subscriptions/components/BulkImportDialog.svelte";
import type { BulkImportSectionView } from "@/features/subscriptions/components/bulk-import-types";
import SubscriptionsList from "./SubscriptionsList.svelte";
import SubscriptionsQuickAddDialog from "./SubscriptionsQuickAddDialog.svelte";
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
export let canMatchImportSections: boolean;
export let formatMessage: FormatMessage;
export let namePrimary: NameFormatter;
export let nameSecondary: NameFormatter;
export let resetBulkImport: DashboardSubscriptionsTabProps["resetBulkImport"];
export let searchQuickAddSections: DashboardSubscriptionsTabProps["searchQuickAddSections"];
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
export let removingSectionId: DashboardSubscriptionsTabProps["removingSectionId"];
export let subscribeQuickAddSections: DashboardSubscriptionsTabProps["subscribeQuickAddSections"];
export let subscriptionActionError: string;
export let matchedSections: MatchedImportSection[];
export let unmatchedSectionCodes: string[];

let isQuickAddOpen = false;

function openQuickAddDialog() {
  isQuickAddOpen = true;
}

function setBulkImportOpen(open: boolean) {
  if (!open) resetBulkImport();
  isBulkImportOpen = open;
}

function cancelBulkImport() {
  resetBulkImport();
  isBulkImportOpen = false;
}

function setConfirmImportOpen(open: boolean) {
  isConfirmImportOpen = open;
}

function cancelConfirmImport() {
  isConfirmImportOpen = false;
}

function setImportSectionSelection(sectionId: number, checked: boolean) {
  if (selectedImportSectionIdSet.has(sectionId) !== checked) {
    toggleImportSectionSelection(sectionId);
  }
}

$: bulkImportSections = matchedSections.map<BulkImportSectionView>(
  (section) => ({
    campusName: section.campus ? namePrimary(section.campus) : undefined,
    code: section.code,
    courseName: namePrimary(section.course),
    courseSecondaryName: nameSecondary(section.course) || undefined,
    id: section.id,
    semesterName: section.semester ? namePrimary(section.semester) : undefined,
    teacherNames:
      section.teachers.map(namePrimary).filter(Boolean).join(", ") || undefined,
  }),
);
</script>

<section class="grid gap-4">
  {#if signedData.subscriptions.subscriptions.length > 0}
    <SubscriptionsTabToolbar
      calendarSubscriptionUrl={signedData.subscriptions.calendarSubscriptionUrl ?? null}
      {openBulkImportDialog}
      {openQuickAddDialog}
      {sectionCopy}
      {subscriptionsCopy}
    />
  {/if}

  <SubscriptionsStatusAlerts
    {bulkImportError}
    {bulkImportMessage}
    {subscriptionActionError}
  />

  <SubscriptionsList
    {dashboardCopy}
    {formatMessage}
    {removeSubscribedSection}
    {removingSectionId}
    {sectionCopy}
    subscriptions={signedData.subscriptions.subscriptions}
    {subscriptionsCopy}
    {openBulkImportDialog}
    {openQuickAddDialog}
  />

  <SubscriptionsQuickAddDialog
    bind:open={isQuickAddOpen}
    {formatMessage}
    {namePrimary}
    {searchQuickAddSections}
    {subscribeQuickAddSections}
    {signedData}
    {subscriptionsCopy}
  />

  <BulkImportDialog
    canMatch={canMatchImportSections}
    copy={subscriptionsCopy.bulkImport}
    error={bulkImportError}
    bind:importText={bulkImportText}
    importMessage={bulkImportMessage}
    isMatching={isMatchingSections}
    bind:isOpen={isBulkImportOpen}
    match={matchImportSections}
    onCancel={cancelBulkImport}
    onOpenChange={setBulkImportOpen}
    bind:semesterId={bulkImportSemesterId}
    semesterOptions={signedData.subscriptions.semesters.map((semester) => ({
      label: semester.nameCn,
      value: String(semester.id),
    }))}
  />

  <BulkImportConfirmDialog
    copy={subscriptionsCopy.bulkImport}
    {formatMessage}
    importError={bulkImportError}
    isImporting={isImportingSections}
    bind:isOpen={isConfirmImportOpen}
    matchedSections={bulkImportSections}
    onCancel={cancelConfirmImport}
    onConfirm={confirmImportSections}
    onOpenChange={setConfirmImportOpen}
    selectedSectionIdSet={selectedImportSectionIdSet}
    setSectionSelection={setImportSectionSelection}
    unmatchedCodes={unmatchedSectionCodes}
  />
</section>
