<script lang="ts">
import BulkImportConfirmDialog from "@/features/subscriptions/components/BulkImportConfirmDialog.svelte";
import BulkImportDialog from "@/features/subscriptions/components/BulkImportDialog.svelte";
import type {
  BulkImportCopy,
  BulkImportSectionView,
} from "@/features/subscriptions/components/bulk-import-types";
import type {
  WelcomeBulkImportCopy,
  WelcomeCopy,
  WelcomeDisplayName,
  WelcomeFormatCopy,
  WelcomeImportAction,
  WelcomeMatchedSection,
  WelcomeSectionSelectionSetter,
  WelcomeSelectOption,
} from "./welcome-component-types";

export let bulkCopy: WelcomeBulkImportCopy;
export let canMatch: boolean;
export let confirmImport: WelcomeImportAction;
export let displayName: WelcomeDisplayName;
export let formatCopy: WelcomeFormatCopy;
export let importError: string;
export let importMessage: string;
export let importText: string;
export let isBulkImportOpen: boolean;
export let isConfirmImportOpen: boolean;
export let isImporting: boolean;
export let isMatching: boolean;
export let matchSections: WelcomeImportAction;
export let matchedSections: WelcomeMatchedSection[];
export let resetBulkImport: () => void;
export let selectedSectionIdSet: Set<number>;
export let selectedSemesterId: string;
export let semesterOptions: WelcomeSelectOption[];
export let setSectionSelection: WelcomeSectionSelectionSetter;
export let unmatchedCodes: string[];
export let welcomeCopy: WelcomeCopy;

$: bulkImportCopy = {
  ...bulkCopy,
  confirmTitle: welcomeCopy.confirmImportTitle,
  importing: welcomeCopy.importing,
  matchedSummary: welcomeCopy.matchedSummary,
  noMatches: welcomeCopy.noMatchingSections,
  sectionCodesLabel: welcomeCopy.sectionCodesLabel,
  selectSection: welcomeCopy.selectSection,
  subscribeSelected: welcomeCopy.subscribeSelected,
} satisfies BulkImportCopy;
$: bulkImportSections = matchedSections.map<BulkImportSectionView>(
  (section) => ({
    campusName: section.campus ? displayName(section.campus) : undefined,
    code: section.code,
    courseName: displayName(section.course),
    id: section.id,
    semesterName: section.semester ? displayName(section.semester) : undefined,
    teacherNames:
      section.teachers.map(displayName).filter(Boolean).join(", ") || undefined,
  }),
);

function cancelBulkImport() {
  resetBulkImport();
  isBulkImportOpen = false;
}

function setBulkImportOpen(open: boolean) {
  isBulkImportOpen = open;
}

function cancelConfirmImport() {
  isConfirmImportOpen = false;
}

function setConfirmImportOpen(open: boolean) {
  isConfirmImportOpen = open;
}
</script>

<BulkImportDialog
  {canMatch}
  copy={bulkImportCopy}
  error={importError}
  bind:importText
  {importMessage}
  {isMatching}
  isOpen={isBulkImportOpen}
  match={matchSections}
  onCancel={cancelBulkImport}
  onOpenChange={setBulkImportOpen}
  bind:semesterId={selectedSemesterId}
  {semesterOptions}
/>

<BulkImportConfirmDialog
  copy={bulkImportCopy}
  importError={importError}
  isImporting={isImporting}
  isOpen={isConfirmImportOpen}
  matchedSections={bulkImportSections}
  onCancel={cancelConfirmImport}
  onConfirm={confirmImport}
  onOpenChange={setConfirmImportOpen}
  selectedSectionIdSet={selectedSectionIdSet}
  setSectionSelection={setSectionSelection}
  unmatchedCodes={unmatchedCodes}
  formatMessage={formatCopy}
/>
