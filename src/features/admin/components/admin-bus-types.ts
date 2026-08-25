export type AdminBusVersion = {
  effectiveFrom?: string | null;
  effectiveUntil?: string | null;
  id: string | number;
  importedAt: string | Date;
  isEnabled: boolean;
  key: string;
  sourceMessage?: string | null;
  title: string;
  tripCount: number;
};

export type AdminBusEnhancedAction = (
  actionKey: string,
  onSuccess?: () => void,
) => import("@sveltejs/kit").SubmitFunction;

export type AdminBusVersionFormatter = (version: AdminBusVersion) => string;

export type AdminBusCopy = {
  activated: string;
  activateAction: string;
  activateDescription: string;
  activateTitle: string;
  cancelAction: string;
  colActions: string;
  colEffective: string;
  colImported: string;
  colKey: string;
  colStatus: string;
  colTitle: string;
  colTrips: string;
  confirmDeleteAction: string;
  confirmActivateAction: string;
  deleteAction: string;
  deleteDescription: string;
  deleteTitle: string;
  importAction: string;
  importDescription: string;
  importWarning: string;
  importSuccess: string;
  noVersions: string;
  statusActive: string;
  statusInactive: string;
  deleted: string;
  subtitle: string;
  title: string;
  versionsDescription: string;
  versionsTitle: string;
};

export type AdminBusHeaderAdminCopy = {
  title: string;
};
