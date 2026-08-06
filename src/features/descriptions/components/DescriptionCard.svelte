<script lang="ts">
import {
  createDescriptionCardActions,
  type DescriptionData,
  type DescriptionHistoryItem,
  type DescriptionPayload,
  type DescriptionTargetType,
  type DescriptionViewer,
} from "@/features/descriptions/lib/description-card-actions";
import type { AppLocale } from "@/i18n/config";
import { createShanghaiDateTimeFormatter } from "@/lib/time/shanghai-format";
import SoftEmptyMessage from "$lib/components/SoftEmptyMessage.svelte";
import * as Alert from "$lib/components/ui/alert/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import DescriptionCardHeader from "./DescriptionCardHeader.svelte";
import DescriptionEditPanel from "./DescriptionEditPanel.svelte";
import DescriptionReadPanel from "./DescriptionReadPanel.svelte";
import DescriptionSuspensionAlert from "./DescriptionSuspensionAlert.svelte";

type PanelTab = "description" | "history";

export let targetType: DescriptionTargetType;
export let targetId: number | string;
export let initialData: DescriptionPayload;
/** When set, renders a page-style h2 + primary action row above the body. */
export let heading: string | null = null;
export let showTitle = true;
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
let history = initialData.history;
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

$: softEmpty =
  !_editing && !description.content && history.length === 0 && !_message;

$: usePageHeading = Boolean(heading);
$: showInlineTitle = showTitle && !usePageHeading;
$: showInlineAction = true;

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

{#if usePageHeading}
  <div class="mb-3">
    <h2 class="text-lg font-semibold tracking-tight">{heading}</h2>
  </div>
{/if}

{#if softEmpty}
  <div class="grid gap-3">
    {#if showInlineTitle || showInlineAction}
      <div
        class="flex flex-wrap items-center gap-3"
        class:justify-between={showInlineTitle}
        class:justify-end={!showInlineTitle}
      >
        {#if showInlineTitle}
          <h3 class="min-w-0 text-base font-semibold tracking-tight">{copy.title}</h3>
        {/if}
        {#if showInlineAction}
          {#if _viewer.isAuthenticated && !_viewer.isSuspended}
            <Button type="button" variant="outline" onclick={_startEdit}>
              {copy.edit}
            </Button>
          {:else if !_viewer.isAuthenticated}
            <Button href="/account/sign-in" variant="outline">{copy.loginToEdit}</Button>
          {/if}
        {/if}
      </div>
    {/if}
    {#if _viewer.isSuspended}
      <DescriptionSuspensionAlert {copy} formatDate={_formatDate} viewer={_viewer} />
    {/if}
    <SoftEmptyMessage message={copy.empty} />
  </div>
{:else}
  <div class="grid w-full gap-4">
    <DescriptionCardHeader
      {copy}
      {description}
      showTitle={showInlineTitle}
      showAction={showInlineAction}
      editing={_editing}
      editorName={_editorName}
      formatDate={_formatDate}
      onStartEdit={_startEdit}
      viewer={_viewer}
    />

    <div class="grid gap-5">
      {#if _viewer.isSuspended}
        <DescriptionSuspensionAlert {copy} formatDate={_formatDate} viewer={_viewer} />
      {/if}

      {#if _message}
        <Alert.Root variant="destructive">
          <Alert.Description>{_message}</Alert.Description>
        </Alert.Root>
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
    </div>
  </div>
{/if}
