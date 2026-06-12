<script lang="ts">
import AdminBusDialogs from "@/features/admin/components/AdminBusDialogs.svelte";
import AdminBusHeader from "@/features/admin/components/AdminBusHeader.svelte";
import AdminBusStatusAlert from "@/features/admin/components/AdminBusStatusAlert.svelte";
import AdminBusSummaryStats from "@/features/admin/components/AdminBusSummaryStats.svelte";
import AdminBusVersions from "@/features/admin/components/AdminBusVersions.svelte";
import { createAdminBusControllerDefaultState } from "@/features/admin/lib/admin-bus-controller-default-state";
import { formatBusVersionEffectiveRange } from "@/features/admin/lib/admin-bus-formatters";
import { createPendingEnhancedAction } from "@/features/admin/lib/admin-enhanced-action";
import { createShanghaiDateTimeFormatter } from "@/lib/time/shanghai-format";
import type {
  AdminBusCopy,
  AdminBusHeaderAdminCopy,
  AdminBusHeaderCommonCopy,
  AdminBusVersion,
} from "./admin-bus-types";

type PageData = {
  copy: {
    admin: AdminBusHeaderAdminCopy;
    adminBus: AdminBusCopy;
    common: AdminBusHeaderCommonCopy;
  };
  locale: string;
  summary: {
    active?: string | null;
    campuses: number;
    routes: number;
    versions: number;
  };
  versions: AdminBusVersion[];
};
type ActionData = Record<string, unknown> | null | undefined;

export let data: PageData;
export let form: ActionData;

let { isImportDialogOpen, pendingAction, pendingDeleteVersion } =
  createAdminBusControllerDefaultState();

$: copy = data.copy.adminBus;
$: adminCopy = data.copy.admin;
$: commonCopy = data.copy.common;
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

<section class="grid gap-5">
  <AdminBusHeader
    {adminCopy}
    {commonCopy}
    {copy}
    disabled={Boolean(pendingAction)}
    onImport={openImportDialog}
  />

  <AdminBusStatusAlert {form} />

  <AdminBusSummaryStats {copy} summary={data.summary} />

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
</section>

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
