import type { AdminBusVersion } from "@/features/admin/components/admin-bus-types";

export function createAdminBusControllerDefaultState() {
  return {
    isImportDialogOpen: false,
    pendingAction: null as string | null,
    pendingDeleteVersion: null as AdminBusVersion | null,
  };
}
