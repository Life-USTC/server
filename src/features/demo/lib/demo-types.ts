export const DEMO_FIXTURE_VERSION = "workspace-v1";
export const DEMO_REFERENCE_NOW = "2026-09-24T09:00:00+08:00";

export type DemoIdentity = {
  fixtureVersion: typeof DEMO_FIXTURE_VERSION;
  expiresAt: number;
};

/** Presentation data only; this is never a real account or API principal. */
export type DemoView = DemoIdentity & {
  referenceNow: string;
  displayName: string;
  readOnlyReason: string;
  exitLabel: string;
  unavailableReason: string;
  referenceTimeLabel: string;
};
