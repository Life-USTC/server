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
  activateAction: string;
  cancelAction: string;
  colActions: string;
  colEffective: string;
  colImported: string;
  colKey: string;
  colStatus: string;
  colTitle: string;
  colTrips: string;
  confirmDeleteAction: string;
  deleteAction: string;
  deleteDescription: string;
  deleteTitle: string;
  importAction: string;
  importDescription: string;
  importWarning: string;
  noVersions: string;
  statActive: string;
  statActiveMeta: string;
  statCampuses: string;
  statCampusesMeta: string;
  statNone: string;
  statRoutes: string;
  statRoutesMeta: string;
  statVersions: string;
  statVersionsMeta: string;
  statusActive: string;
  statusInactive: string;
  subtitle: string;
  title: string;
  versionsDescription: string;
  versionsTitle: string;
};

export type AdminBusHeaderAdminCopy = {
  title: string;
};

export type AdminBusHeaderCommonCopy = {
  home: string;
};
