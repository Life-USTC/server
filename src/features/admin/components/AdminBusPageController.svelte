<script lang="ts">
import AdminBusDialogs from "@/features/admin/components/AdminBusDialogs.svelte";
import AdminBusHeader from "@/features/admin/components/AdminBusHeader.svelte";
import AdminBusStatusAlerts from "@/features/admin/components/AdminBusStatusAlerts.svelte";
import AdminBusVersions from "@/features/admin/components/AdminBusVersions.svelte";
import AdminWorkspace from "@/features/admin/components/AdminWorkspace.svelte";
import { createAdminBusControllerDefaultState } from "@/features/admin/lib/admin-bus-controller-default-state";
import { formatBusVersionEffectiveRange } from "@/features/admin/lib/admin-bus-formatters";
import { createPendingEnhancedAction } from "@/features/admin/lib/admin-enhanced-action";
import { createShanghaiDateTimeFormatter } from "@/lib/time/shanghai-format";
import type {
  AdminBusCopy,
  AdminBusHeaderAdminCopy,
  AdminBusVersion,
} from "./admin-bus-types";

type PageData = {
  copy: {
    admin: AdminBusHeaderAdminCopy;
    adminBus: AdminBusCopy;
  };
  locale: string;
  versions: AdminBusVersion[];
};

type ActionData =
  | {
      message?: string;
      variant?: "destructive" | "default";
    }
  | null
  | undefined;

export let data: PageData;
export let form: ActionData;

let { isImportDialogOpen, pendingAction, pendingDeleteVersion } =
  createAdminBusControllerDefaultState();

$: copy = data.copy.adminBus;
$: adminCopy = data.copy.admin;
$: dateTimeFormatter = createShanghaiDateTimeFormatter(data.locale, {
  dateStyle: "medium",
  timeStyle: "short",
});
function formatEffectiveRange(version: AdminBusVersion) {
  return formatBusVersionEffectiveRange(version);
}

function formatImportedAt(value: string | Date) {
  return dateTimeFormatter.format(new Date(value));
}

function openImportDialog() {
  isImportDialogOpen = true;
}

function closeImportDialog() {
  isImportDialogOpen = false;
}

function openDeleteDialog(version: AdminBusVersion) {
  pendingDeleteVersion = version;
}

function closeDeleteDialog() {
  pendingDeleteVersion = null;
}

function isPending(actionKey: string) {
  return pendingAction === actionKey;
}

const enhancedAction = createPendingEnhancedAction({
  setPendingAction: (value) => {
    pendingAction = value;
  },
});
</script>

<svelte:head><title>{copy.title} - Life@USTC</title></svelte:head>

<AdminWorkspace>
  {#snippet header()}
    <AdminBusHeader
      {adminCopy}
      {copy}
      disabled={Boolean(pendingAction)}
      onImport={openImportDialog}
    />
  {/snippet}
  {#snippet feedback()}
    <AdminBusStatusAlerts {form} />
  {/snippet}
  <AdminBusVersions
    {copy}
    {enhancedAction}
    {formatEffectiveRange}
    {formatImportedAt}
    {isPending}
    onDelete={openDeleteDialog}
    {pendingAction}
    versions={data.versions}
  />
</AdminWorkspace>

<AdminBusDialogs
  {closeDeleteDialog}
  {closeImportDialog}
  {copy}
  {enhancedAction}
  {isImportDialogOpen}
  {isPending}
  {pendingAction}
  {pendingDeleteVersion}
/>
