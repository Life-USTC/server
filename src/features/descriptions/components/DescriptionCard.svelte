<script lang="ts">
import { onMount } from "svelte";
import { toast } from "svelte-sonner";
import {
  createDescriptionCardActions,
  type DescriptionData,
  type DescriptionHistoryItem,
  type DescriptionPayload,
  type DescriptionTargetType,
  type DescriptionViewer,
} from "@/features/descriptions/lib/description-card-actions";
import { fetchDescriptionPayload } from "@/features/descriptions/lib/description-card-client";
import type { AppLocale } from "@/i18n/config";
import { getShellViewer } from "@/lib/shell/shell-viewer";
import { createShanghaiDateTimeFormatter } from "@/lib/time/shanghai-format";
import { invalidateAll } from "$app/navigation";
import * as Alert from "$lib/components/ui/alert/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Empty from "$lib/components/ui/empty/index.js";
import { Skeleton } from "$lib/components/ui/skeleton";
import DescriptionCardHeader from "./DescriptionCardHeader.svelte";
import DescriptionEditPanel from "./DescriptionEditPanel.svelte";
import DescriptionReadPanel from "./DescriptionReadPanel.svelte";
import DescriptionSuspensionAlert from "./DescriptionSuspensionAlert.svelte";

type PanelTab = "description" | "history";

export let targetType: DescriptionTargetType;
export let targetId: number | string;
export let initialData: DescriptionPayload;
export let resolveViewer = false;
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
  retry: string;
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
  updateSuccess?: string;
};

let description = initialData.description;
let history = initialData.history;
let viewer = initialData.viewer;
let viewerLoading = resolveViewer;
let viewerFailed = false;
let destroyed = false;
const shellViewer = getShellViewer();
$: shellViewerId = $shellViewer.viewer?.id ?? null;
$: shellViewerStatus = $shellViewer.status;
let mounted = false;
let viewerGeneration = 0;
$: viewerIdentity = `${shellViewerStatus}:${shellViewerId ?? ""}`;
$: if (resolveViewer && mounted) resetViewer(viewerIdentity);
function resetViewer(_identity: string) {
  viewerGeneration += 1;
  viewer = initialData.viewer;
  isEditing = false;
  draft = "";
  message = "";
  isSaving = false;
  viewerLoading = shellViewerStatus === "loading";
  viewerFailed = shellViewerStatus === "error";
  if (shellViewerStatus === "ready" && shellViewerId) void loadViewer();
}
async function loadViewer() {
  const generation = ++viewerGeneration;
  viewerLoading = true;
  viewerFailed = false;
  try {
    const result = await fetchDescriptionPayload({ targetId, targetType });
    if (!result.ok || !result.payload) throw new Error(copy.loadFailed);
    if (destroyed || generation !== viewerGeneration) return;
    viewer = result.payload.viewer;
    history = result.payload.history;
    description = result.payload.description;
  } catch {
    if (!destroyed && generation === viewerGeneration) viewerFailed = true;
  } finally {
    if (!destroyed && generation === viewerGeneration) viewerLoading = false;
  }
}
async function retryViewer() {
  if (shellViewerStatus === "error") {
    await invalidateAll();
    return;
  }
  if (shellViewerStatus === "ready" && shellViewerId) void loadViewer();
}
onMount(() => {
  mounted = true;
  return () => {
    destroyed = true;
    viewerGeneration += 1;
  };
});
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
    getGeneration: () => viewerGeneration,
    canEdit: () =>
      !destroyed &&
      !viewerLoading &&
      !viewerFailed &&
      viewer.isAuthenticated &&
      !viewer.isSuspended,
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
    onSuccess: () => toast.success(copy.updateSuccess ?? copy.updatedLabel),
  });
</script>

{#if usePageHeading}
  <div class="mb-3 flex flex-wrap items-center gap-3">
    <h2 class="text-lg font-semibold tracking-tight">{heading}</h2>
    {#if viewerLoading}
      <Skeleton class="h-9 w-24" />
    {:else if !viewerFailed && viewer.isAuthenticated && !viewer.isSuspended && !isEditing}
      <Button
        data-testid="description-edit"
        type="button"
        variant="outline"
        onclick={startEdit}
      >
        {copy.edit}
      </Button>
    {:else if !viewerFailed && !viewer.isAuthenticated}
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
  {#if viewerFailed}
    <Alert.Root variant="destructive">
      <Alert.Description>{copy.loadFailed}</Alert.Description>
      <Button variant="outline" onclick={() => void retryViewer()}>{copy.retry}</Button>
    </Alert.Root>
  {/if}
  <DescriptionCardHeader
    {copy}
    {description}
    showTitle={showInlineTitle}
    showAction={showInlineAction && !viewerLoading && !viewerFailed}
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
        isDisabled={viewerLoading || viewerFailed || !viewer.isAuthenticated || viewer.isSuspended}
        {isSaving}
        {saveDescription}
      />
    {:else if softEmpty}
      <Empty.Root class="min-h-20 border-0 px-2 py-6">
        <Empty.Header>
          <Empty.Description>{copy.empty}</Empty.Description>
        </Empty.Header>
      </Empty.Root>
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
