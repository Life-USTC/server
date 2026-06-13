import { sha256Hex } from "@/lib/crypto/web-crypto";
import type { BusStaticPayload } from "./bus-types";

const SEASON_START_MONTH = {
  春: 2,
  夏: 6,
  秋: 9,
  冬: 12,
} as const;

export function checksumBusPayload(payload: BusStaticPayload) {
  return sha256Hex(JSON.stringify(payload));
}

export function inferBusVersionKey(
  payload: BusStaticPayload,
  explicitKey?: string | null,
) {
  if (explicitKey?.trim()) {
    return explicitKey.trim();
  }

  const message = payload.message?.message?.trim();
  const yearSeason = message?.match(/(\d{4})\s*([春夏秋冬])/);
  if (yearSeason) {
    return `static-bus-${yearSeason[1]}-${yearSeason[2]}`;
  }

  return `static-bus-${new Date().toISOString().slice(0, 10)}`;
}

export function inferBusVersionTitle(
  payload: BusStaticPayload,
  explicitTitle?: string | null,
) {
  if (explicitTitle?.trim()) {
    return explicitTitle.trim();
  }
  return payload.message?.message?.trim() || "Life@USTC 校车时刻表";
}

export function inferBusEffectiveFrom(
  payload: BusStaticPayload,
  explicitEffectiveFrom?: Date | null,
) {
  if (explicitEffectiveFrom) return explicitEffectiveFrom;

  const message = payload.message?.message?.trim();
  const yearSeason = message?.match(/(\d{4})\s*([春夏秋冬])/);
  if (!yearSeason) return null;

  const year = Number(yearSeason[1]);
  const season = yearSeason[2] as keyof typeof SEASON_START_MONTH;
  const month = SEASON_START_MONTH[season];

  return new Date(Date.UTC(year, month - 1, 1));
}
