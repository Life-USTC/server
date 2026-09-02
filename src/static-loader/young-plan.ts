import type { Snapshot } from "./snapshot";
import { asFloat, asInt, asString, type SnapshotRow } from "./snapshot-values";

const ACTIVE_TABLE = "young_mobile_item_enrolment_list_result_records";
const ENDED_TABLE = "young_mobile_item_end_list_result_records";

// Internal bookkeeping columns added by the snapshot store, not upstream data.
const INTERNAL_COLUMNS = new Set([
  "store_id",
  "fetch_id",
  "parent_store_id",
  "position",
  "value",
  "list_type",
]);

// Upstream datetimes look like "2026-08-08 23:13:00" in Asia/Shanghai.
// Shanghai has observed a fixed UTC+08:00 offset since 1991 (no DST), so
// appending the offset is an exact parse.
function asShanghaiDateTime(value: unknown): Date | undefined {
  const str = asString(value);
  if (str == null) return undefined;
  const normalized = str.replace(" ", "T");
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(normalized)) {
    return undefined;
  }
  const date = new Date(`${normalized}+08:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export type YoungEventBuild = {
  youngId: string;
  name: string;
  category?: string;
  department?: string;
  organizer?: string;
  status?: string;
  registrationStatus?: string;
  location?: string;
  imageUrl?: string;
  hours?: number;
  capacity?: number;
  appliedCount?: number;
  startAt?: Date;
  endAt?: Date;
  applyStartAt?: Date;
  applyEndAt?: Date;
  isActive: boolean;
  rawJson: string;
};

function mapYoungEventRow(
  row: SnapshotRow,
  isActive: boolean,
): YoungEventBuild | null {
  const youngId = asString(row.id);
  if (youngId == null) return null;

  const raw: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (!INTERNAL_COLUMNS.has(key)) raw[key] = value;
  }

  return {
    youngId,
    name: asString(row.itemName) ?? youngId,
    category: asString(row.itemCategory_dictText),
    department: asString(row.businessDeptName),
    organizer:
      asString(row.organizer_dictText) ?? asString(row.sponsor_dictText),
    status: asString(row.itemStatus_dictText),
    registrationStatus: asString(row.registrationStatus),
    location: asString(row.placeInfo),
    imageUrl: asString(row.pic),
    hours: asFloat(row.validHour) ?? asFloat(row.hours),
    capacity: asInt(row.peopleNum),
    appliedCount: asInt(row.applyNum),
    startAt: asShanghaiDateTime(row.st),
    endAt: asShanghaiDateTime(row.et),
    applyStartAt: asShanghaiDateTime(row.applySt),
    applyEndAt: asShanghaiDateTime(row.applyEt),
    isActive,
    rawJson: JSON.stringify(raw),
  };
}

/**
 * Load Young signup events from the static snapshot. Returns null when the
 * snapshot predates the young builder (tables absent), so callers can skip
 * the import without wiping previously imported rows.
 */
export function loadYoungEvents(snapshot: Snapshot): YoungEventBuild[] | null {
  const metadata = snapshot.metadata();
  if (metadata.young_events_mode == null) return null;

  const merged = new Map<string, YoungEventBuild>();
  // Ended first so active rows win on a youngId conflict.
  if (snapshot.hasTable(ENDED_TABLE)) {
    for (const row of snapshot.queryAll(ENDED_TABLE)) {
      const build = mapYoungEventRow(row, false);
      if (build != null) merged.set(build.youngId, build);
    }
  }
  if (snapshot.hasTable(ACTIVE_TABLE)) {
    for (const row of snapshot.queryAll(ACTIVE_TABLE)) {
      const build = mapYoungEventRow(row, true);
      if (build != null) merged.set(build.youngId, build);
    }
  }
  return [...merged.values()];
}
