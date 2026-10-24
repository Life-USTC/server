export const DEMO_FIXTURE_VERSION = "todos-v1";

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
