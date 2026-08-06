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
let viewer = initialData.viewer;
let isEditing = false;
let draft = "";
let isSaving = false;
let message = "";
let activePanelTab: PanelTab = "description";

$: dateTimeFormatter = createShanghaiDateTimeFormatter(locale, {
  dateStyle: "medium",
  timeStyle: "short",
});

$: softEmpty = !description.content && history.length === 0 && !message;

$: usePageHeading = Boolean(heading);
$: showInlineTitle = showTitle && !usePageHeading;
/** Page heading owns the primary edit/login action when present. */
$: showInlineAction = !usePageHeading;

function formatDate(value: string | null | undefined) {
  if (!value) return "";
  return dateTimeFormatter.format(new Date(value));
}

const { cancelEdit, editorName, saveDescription, startEdit } =
  createDescriptionCardActions({
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
      isEditing = value;
    },
    setHistory: (value: DescriptionHistoryItem[]) => {
      history = value;
    },
    setMessage: (value: string) => {
      message = value;
    },
    setSaving: (value: boolean) => {
      isSaving = value;
    },
    setViewer: (value: DescriptionViewer) => {
      viewer = value;
    },
  });
</script>

{#if usePageHeading}
  <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
    <h2 class="text-lg font-semibold tracking-tight">{heading}</h2>
    {#if viewer.isAuthenticated && !viewer.isSuspended && !isEditing}
      <Button
        data-testid="description-edit"
        type="button"
        variant="outline"
        onclick={startEdit}
      >
        {copy.edit}
      </Button>
    {:else if !viewer.isAuthenticated}
      <Button
        data-testid="description-edit-login"
        href="/account/sign-in"
        variant="outline"
      >
        {copy.loginToEdit}
      </Button>
    {/if}
  </div>
{/if}

<div class="grid w-full gap-4">
  <DescriptionCardHeader
    {copy}
    {description}
    showTitle={showInlineTitle}
    showAction={showInlineAction}
    editing={isEditing}
    editorName={editorName}
    formatDate={formatDate}
    onStartEdit={startEdit}
    viewer={viewer}
  />

  <div class="grid gap-5">
    {#if viewer.isSuspended}
      <DescriptionSuspensionAlert {copy} formatDate={formatDate} {viewer} />
    {/if}

    {#if message}
      <Alert.Root variant="destructive">
        <Alert.Description>{message}</Alert.Description>
      </Alert.Root>
    {/if}

    {#if isEditing}
      <DescriptionEditPanel
        {cancelEdit}
        {copy}
        bind:draft
        isDisabled={!viewer.isAuthenticated || viewer.isSuspended}
        {isSaving}
        {saveDescription}
      />
    {:else if softEmpty}
      <SoftEmptyMessage message={copy.empty} />
    {:else}
      <DescriptionReadPanel
        bind:activePanelTab
        {copy}
        {description}
        formatDate={formatDate}
        {history}
      />
    {/if}
  </div>
</div>
