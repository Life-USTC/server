import type { BusStaticPayload } from "./bus-types";

export function buildBusScheduleVersionData(input: {
  checksum: string;
  effectiveFrom: Date | null;
  effectiveUntil: Date | null;
  payload: BusStaticPayload;
  versionKey: string;
  versionTitle: string;
}) {
  return {
    key: input.versionKey,
    title: input.versionTitle,
    checksum: input.checksum,
    sourceMessage: input.payload.message?.message?.trim() || null,
    sourceUrl: input.payload.message?.url?.trim() || null,
    rawJson: input.payload,
    effectiveFrom: input.effectiveFrom,
    effectiveUntil: input.effectiveUntil,
    isEnabled: true,
  };
}
