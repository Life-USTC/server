<script lang="ts">
import Download from "@lucide/svelte/icons/download";
import { toast } from "@ui-sdk/svelte/toast";
import PageHeader from "#lib/components/PageHeader.svelte";
import * as Alert from "#lib/components/ui/alert/index.js";
import { Button } from "#lib/components/ui/button/index.js";
import AdminBusDeleteDialog from "@/features/admin/components/AdminBusDeleteDialog.svelte";
import AdminBusImportDialog from "@/features/admin/components/AdminBusImportDialog.svelte";
import AdminBusVersions from "@/features/admin/components/AdminBusVersions.svelte";
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
        <Button class="w-full sm:w-auto" type="button" disabled={Boolean(pendingAction)} onclick={() => (isImportDialogOpen = true)}>
          <Download data-icon="inline-start" />
          {copy.importAction}
        </Button>
      {/snippet}
    </PageHeader>
  {/snippet}
  {#snippet feedback()}
    {#if form?.message && form.variant === "destructive"}
      <Alert.Root variant={form.variant ?? "default"}>
        <Alert.Description>{form.message}</Alert.Description>
      </Alert.Root>
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
  <AdminBusDeleteDialog
    close={() => (pendingDeleteVersion = null)}
    {copy}
    {enhancedAction}
    {pendingAction}
    version={pendingDeleteVersion}
  />
{/if}
