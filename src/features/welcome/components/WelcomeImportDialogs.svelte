<script lang="ts">
import WelcomeBulkImportDialog from "@/features/welcome/components/WelcomeBulkImportDialog.svelte";
import WelcomeConfirmImportDialog from "@/features/welcome/components/WelcomeConfirmImportDialog.svelte";
import type {
  WelcomeBulkImportCopy,
  WelcomeCopy,
  WelcomeDisplayName,
  WelcomeFormatCopy,
  WelcomeImportAction,
  WelcomeMatchedSection,
  WelcomeSectionSelectionSetter,
  WelcomeSectionSelectionToggle,
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
export let selectedCount: number;
export let selectedSectionIdSet: Set<number>;
export let selectedSemesterId: string;
export let semesterOptions: WelcomeSelectOption[];
export let setSectionSelection: WelcomeSectionSelectionSetter;
export let toggleSectionSelection: WelcomeSectionSelectionToggle;
export let unmatchedCodes: string[];
export let welcomeCopy: WelcomeCopy;
</script>

<WelcomeBulkImportDialog
  {bulkCopy}
  {canMatch}
  {importError}
  {importMessage}
  bind:importText
  bind:isBulkImportOpen
  {isMatching}
  {matchSections}
  {resetBulkImport}
  bind:selectedSemesterId
  {semesterOptions}
  {welcomeCopy}
/>

<WelcomeConfirmImportDialog
  {bulkCopy}
  {confirmImport}
  {displayName}
  {formatCopy}
  bind:isConfirmImportOpen
  {isImporting}
  {matchedSections}
  {selectedCount}
  {selectedSectionIdSet}
  {setSectionSelection}
  {toggleSectionSelection}
  {unmatchedCodes}
  {welcomeCopy}
/>
