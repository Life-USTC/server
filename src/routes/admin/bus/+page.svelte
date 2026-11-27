<script lang="ts">
import Download from "@lucide/svelte/icons/download";
import { toast } from "@ui-sdk/svelte/toast";
import PageHeader from "#lib/components/PageHeader.svelte";
import * as Alert from "#lib/components/ui/alert/index.js";
import { Button } from "#lib/components/ui/button/index.js";
import AdminBusImportDialog from "@/features/admin/components/AdminBusImportDialog.svelte";
import AdminBusVersions from "@/features/admin/components/AdminBusVersions.svelte";
import AdminDeleteDialog from "@/features/admin/components/AdminDeleteDialog.svelte";
import AdminWorkspace from "@/features/admin/components/AdminWorkspace.svelte";
import type { AdminBusVersion } from "@/features/admin/components/admin-bus-types";
import {
  createPendingEnhancedAction,
  serverOutcomeMessage,
} from "@/features/admin/lib/admin-enhanced-action";
import type { ActionData, PageData } from "./$types";

let { data, form }: { data: PageData; form: ActionData } = $props();
let isImportDialogOpen = $state(false);
let pendingAction = $state<string | null>(null);
let pendingDeleteVersion = $state<AdminBusVersion | null>(null);

let copy = $derived(data.copy.adminBus);

const baseEnhancedAction = createPendingEnhancedAction({
  setPendingAction: (value) => {
    pendingAction = value;
  },
});

function enhancedAction(actionKey: string, onSuccess?: () => void) {
  return baseEnhancedAction(actionKey, (data) => {
    onSuccess?.();
    // The import outcome names the campuses, routes and trips that landed; only
    // fall back to the generic phrase when the action reported no message.
    toast.success(
      serverOutcomeMessage(data) ??
        (actionKey === "import"
          ? copy.importSuccess
          : actionKey.startsWith("activate-")
            ? copy.activated
            : copy.deleted),
    );
  });
}
</script>

<svelte:head><title>{copy.title} - Life@USTC</title></svelte:head>

<AdminWorkspace>
  {#snippet header()}
    <PageHeader title={copy.title} description={copy.subtitle} eyebrow={data.copy.admin.title}>
      {#snippet actions()}
        <Button icon={Download} class="w-full sm:w-auto" disabled={Boolean(pendingAction)} onclick={() => (isImportDialogOpen = true)}>
          {copy.importAction}
        </Button>
      {/snippet}
    </PageHeader>
  {/snippet}
  {#snippet feedback()}
    {#if form?.message && form.variant === "destructive"}
      <Alert.Message variant={form.variant ?? "default"}>{form.message}</Alert.Message>
    {/if}
  {/snippet}
  <AdminBusVersions
    {copy}
    {enhancedAction}
    locale={data.locale}
    onDelete={(version) => (pendingDeleteVersion = version)}
    {pendingAction}
    versions={data.versions}
  />
</AdminWorkspace>

{#if isImportDialogOpen}
  <AdminBusImportDialog
    close={() => (isImportDialogOpen = false)}
    {copy}
    {enhancedAction}
    {pendingAction}
  />
{/if}

{#if pendingDeleteVersion}
  {@const version = pendingDeleteVersion}
  {@const close = () => { pendingDeleteVersion = null; }}
  <AdminDeleteDialog
    titleId="bus-delete-title"
    title={copy.deleteTitle}
    description={copy.deleteDescription.replace("{title}", version.title)}
    cancelLabel={copy.cancelAction}
    confirmLabel={copy.confirmDeleteAction}
    {close}
    action="?/deleteVersion"
    submit={enhancedAction(`delete-${version.id}`, close)}
    busy={Boolean(pendingAction)}
    deleting={pendingAction === `delete-${version.id}`}
    wide
  >
    <input type="hidden" name="id" value={version.id} />
    <div class="font-medium">{version.title}</div>
    <div class="break-all font-mono text-muted-foreground text-xs">{version.key}</div>
  </AdminDeleteDialog>
{/if}
