<script lang="ts">
import {
  createDescriptionCardActions,
  type DescriptionData,
  type DescriptionHistoryItem,
  type DescriptionPayload,
  type DescriptionViewer,
} from "@/features/descriptions/lib/description-card-actions";
import type { AppLocale } from "@/i18n/config";
import { createShanghaiDateTimeFormatter } from "@/lib/time/shanghai-format";
import { Alert } from "$lib/components/ui/alert/index.js";
import * as Card from "$lib/components/ui/card/index.js";
import DescriptionCardHeader from "./DescriptionCardHeader.svelte";
import DescriptionEditPanel from "./DescriptionEditPanel.svelte";
import DescriptionReadPanel from "./DescriptionReadPanel.svelte";
import DescriptionSuspensionAlert from "./DescriptionSuspensionAlert.svelte";

type DescriptionTargetType = "section" | "course" | "teacher" | "homework";

type PanelTab = "description" | "history";

export let targetType: DescriptionTargetType;
export let targetId: number | string;
export let initialData: DescriptionPayload;
export let locale: AppLocale = "zh-cn";
export let copy: {
  cancel: string;
  edit: string;
  editedBy: string;
  editorPlaceholder: string;
  editorUnknown: string;
  empty: string;
  emptyValue: string;
  historyEmpty: string;
  historyTitle: string;
  lastEdited: string;
  loadFailed: string;
  loginToEdit: string;
  markdownGuide: string;
  previewEmpty: string;
  previousLabel: string;
  save: string;
  saving: string;
  suspendedExpires: string;
  suspendedMessage: string;
  suspendedPermanent: string;
  suspendedReason: string;
  suspendedTitle: string;
  tabPreview: string;
  tabWrite: string;
  title: string;
  updateError: string;
  updatedLabel: string;
};

let description = initialData.description;
let history = initialData.history ?? [];
let _viewer = initialData.viewer;
let _editing = false;
let draft = "";
let _saving = false;
let _message = "";
let _activePanelTab: PanelTab = "description";

$: _dateTimeFormatter = createShanghaiDateTimeFormatter(locale, {
  dateStyle: "medium",
  timeStyle: "short",
});

function _formatDate(value: string | null | undefined) {
  if (!value) return "";
  return _dateTimeFormatter.format(new Date(value));
}

const {
  cancelEdit: _cancelEdit,
  editorName: _editorName,
  saveDescription: _saveDescription,
  startEdit: _startEdit,
} = createDescriptionCardActions({
  getCopy: () => copy,
  getDescription: () => description,
  getDraft: () => draft,
  getTargetId: () => targetId,
  getTargetType: () => targetType,
  setDescription: (value: DescriptionData) => {
    description = value;
  },
  setDraft: (value: string) => {
    draft = value;
  },
  setEditing: (value: boolean) => {
    _editing = value;
  },
  setHistory: (value: DescriptionHistoryItem[]) => {
    history = value;
  },
  setMessage: (value: string) => {
    _message = value;
  },
  setSaving: (value: boolean) => {
    _saving = value;
  },
  setViewer: (value: DescriptionViewer) => {
    _viewer = value;
  },
});
</script>

<Card.Root>
  <DescriptionCardHeader
    {copy}
    {description}
    editing={_editing}
    editorName={_editorName}
    formatDate={_formatDate}
    onStartEdit={_startEdit}
    viewer={_viewer}
  />

  <Card.Content class="grid gap-5">
    {#if _viewer.isSuspended}
      <DescriptionSuspensionAlert {copy} formatDate={_formatDate} viewer={_viewer} />
    {/if}

    {#if _message}
      <Alert variant="destructive">{_message}</Alert>
    {/if}

    {#if _editing}
      <DescriptionEditPanel
        cancelEdit={_cancelEdit}
        {copy}
        bind:draft
        isDisabled={!_viewer.isAuthenticated || _viewer.isSuspended}
        isSaving={_saving}
        saveDescription={_saveDescription}
      />
    {:else}
      <DescriptionReadPanel
        bind:activePanelTab={_activePanelTab}
        {copy}
        {description}
        formatDate={_formatDate}
        {history}
      />
    {/if}
  </Card.Content>
</Card.Root>
