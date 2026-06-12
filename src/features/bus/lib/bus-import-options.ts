export type BusImportOptions = {
  versionKey?: string | null;
  versionTitle?: string | null;
  effectiveFrom?: Date | null;
  effectiveUntil?: Date | null;
  disablePreviousVersions?: boolean;
};
