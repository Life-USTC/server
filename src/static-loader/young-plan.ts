import type { Snapshot } from "./snapshot";
import { asFloat, asInt, asString, type SnapshotRow } from "./snapshot-values";

const ACTIVE_TABLE = "young_mobile_item_enrolment_list_result_records";
const ENDED_TABLE = "young_mobile_item_end_list_result_records";

/** Only successful Young fetches carry this timestamp; unrelated builders preserve it. */
export function youngSnapshotSyncedAt(snapshot: Snapshot): Date | undefined {
  const metadata = snapshot.metadata();
  const value = metadata.young_events_synced_at;
  if (
    metadata.young_events_mode !== "full" ||
    !snapshot.hasTable(ACTIVE_TABLE) ||
    !snapshot.hasTable(ENDED_TABLE) ||
    !value ||
    !/(Z|[+-]\d{2}:\d{2})$/.test(value)
  )
    return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function isYoungEventsSnapshotComplete(snapshot: Snapshot): boolean {
  return youngSnapshotSyncedAt(snapshot) !== undefined;
}

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

function asBinaryFlag(value: unknown): boolean | undefined {
  const text = asString(value);
  if (text === "1") return true;
  if (text === "0") return false;
  return undefined;
}

/** Identifiers stay in source order; duplicates and empty CSV entries are discarded. */
function commaValues(value: unknown): string[] {
  const text = asString(value);
  return text == null
    ? []
    : [
        ...new Set(
          text
            .split(",")
            .map((part) => part.trim())
            .filter(Boolean),
        ),
      ];
}

function attachmentTypes(value: unknown): string[] {
  return [
    ...new Set(
      commaValues(value)
        .map((part) => part.replace(/^\./, "").toLowerCase())
        .filter((part) => /^[a-z0-9]+$/.test(part)),
    ),
  ];
}

function externalSponsor(value: unknown): string | undefined {
  const text = asString(value);
  return text == null || ["无", "暂无"].includes(text) ? undefined : text;
}

/** One scheduled venue slot from the `itemPlaceDTO.places` subtable. */
export type YoungEventPlace = {
  placeInfo?: string;
  placeSt?: string;
  placeEt?: string;
};

type YoungPlaceSnapshot = {
  places: YoungEventPlace[];
  rawItemPlaceDTO: Record<string, unknown> | Record<string, unknown>[];
};

function upstreamColumns(row: SnapshotRow): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(row).filter(([key]) => !INTERNAL_COLUMNS.has(key)),
  );
}

export type YoungEventBuild = {
  categoryCode?: string;
  moduleCode?: string;
  formCode?: string;
  activityLevelCode?: string;
  departmentId?: string;
  upstreamOrganizerIds?: string[];
  upstreamSponsorIds?: string[];
  tagIds?: string[];
  signupScopeCode?: string;
  signupDepartmentIds?: string[];
  requiresSignupInfo?: boolean;
  allowedAttachmentTypes?: string[];
  isOnline?: boolean;
  onlineMeetingInfo?: string;
  externalSponsor?: string;
  youngId: string;
  name: string;
  category?: string;
  department?: string;
  organizer?: string;
  status?: string;
  activityStatusCode?: string;
  signupStatusCode?: string;
  requiresSignup?: boolean;
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
  /** Upstream rich text, stored verbatim; sanitized only on serialization. */
  description?: string;
  participationNotes?: string;
  activityLevel?: string;
  module?: string;
  form?: string;
  grades?: string;
  sponsor?: string;
  contactName?: string;
  contactTel?: string;
  duration?: number;
  serviceHour?: number;
  sumHours?: number;
  sumPersons?: number;
  partakeNum?: number;
  favCount?: number;
  limitNum?: number;
  createdAtUpstream?: Date;
  auditedAt?: Date;
  updatedAtUpstream?: Date;
  places?: YoungEventPlace[];
};

function mapYoungEventRow(
  row: SnapshotRow,
  isActive: boolean,
  placeSnapshot?: YoungPlaceSnapshot,
): YoungEventBuild | null {
  const youngId = asString(row.id);
  if (youngId == null) return null;

  const raw = upstreamColumns(row);
  if (placeSnapshot) raw.itemPlaceDTO = placeSnapshot.rawItemPlaceDTO;

  return {
    youngId,
    categoryCode: asString(row.itemCategory),
    moduleCode: asString(row.module),
    formCode: asString(row.form),
    activityLevelCode: asString(row.activityLevel),
    departmentId: asString(row.businessDeptId),
    upstreamOrganizerIds: commaValues(row.organizer),
    upstreamSponsorIds: commaValues(row.sponsor),
    tagIds: commaValues(row.itemLable),
    signupScopeCode: asString(row.applyRange),
    signupDepartmentIds: commaValues(row.rangeDeptIds),
    requiresSignupInfo: asBinaryFlag(row.needSignInfo),
    allowedAttachmentTypes: attachmentTypes(row.attaType),
    isOnline: asBinaryFlag(row.onlineStatus),
    onlineMeetingInfo: asString(row.onlineMeetingApp),
    externalSponsor: externalSponsor(row.ewSponsor),
    name: asString(row.itemName) ?? youngId,
    category: asString(row.itemCategory_dictText),
    department: asString(row.businessDeptName),
    organizer:
      asString(row.organizer_dictText) ?? asString(row.sponsor_dictText),
    status: asString(row.itemStatus_dictText),
    activityStatusCode: asString(row.itemStatus),
    signupStatusCode: asString(row.applyStatus),
    requiresSignup: asBinaryFlag(row.needApply),
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
    description: asString(row.baseContent),
    participationNotes: asString(row.conceive),
    activityLevel: asString(row.activityLevel_dictText),
    module: asString(row.module_dictText),
    form: asString(row.form_dictText),
    grades: asString(row.nj),
    sponsor: asString(row.sponsor_dictText),
    contactName: asString(row.linkMan),
    contactTel: asString(row.tel),
    duration: asFloat(row.duration),
    serviceHour: asFloat(row.serviceHour),
    sumHours: asFloat(row.sumHours),
    sumPersons: asInt(row.sumPersons),
    partakeNum: asInt(row.partakeNum),
    favCount: asInt(row.favCount),
    limitNum: asInt(row.itemLimitNum),
    createdAtUpstream: asShanghaiDateTime(row.createTime),
    auditedAt: asShanghaiDateTime(row.auditTime),
    updatedAtUpstream: asShanghaiDateTime(row.updateTime),
    places: placeSnapshot?.places,
  };
}

/**
 * The upstream `itemPlaceDTO.places` array lands in the snapshot as two nested
 * subtables. Walk record store_id -> itemPlaceDTO.store_id -> places rows so
 * per-slot venues survive the import instead of being dropped.
 */
function loadPlacesByRecordStoreId(
  snapshot: Snapshot,
  recordsTable: string,
): Map<number, YoungPlaceSnapshot> {
  const dtoTable = `${recordsTable}_itemPlaceDTO`;
  const placesTable = `${dtoTable}_places`;
  const result = new Map<number, YoungPlaceSnapshot>();
  if (!snapshot.hasTable(dtoTable) || !snapshot.hasTable(placesTable)) {
    return result;
  }

  const dtosByRecord = snapshot.queryGrouped(dtoTable);
  const placesByDto = snapshot.queryGrouped(placesTable);
  for (const [recordStoreId, dtos] of dtosByRecord) {
    const places: YoungEventPlace[] = [];
    const rawDtos: Record<string, unknown>[] = [];
    for (const dto of dtos) {
      const dtoStoreId = asInt(dto.store_id);
      if (dtoStoreId == null) continue;
      const rows = [...(placesByDto.get(dtoStoreId) ?? [])].sort(
        (a, b) => (asInt(a.position) ?? 0) - (asInt(b.position) ?? 0),
      );
      rawDtos.push({
        ...upstreamColumns(dto),
        places: rows.map(upstreamColumns),
      });
      for (const row of rows) {
        const place: YoungEventPlace = {
          placeInfo: asString(row.placeInfo),
          placeSt: asString(row.placeSt),
          placeEt: asString(row.placeEt),
        };
        if (place.placeInfo == null && place.placeSt == null) continue;
        places.push(place);
      }
    }
    if (rawDtos.length > 0) {
      result.set(recordStoreId, {
        places,
        rawItemPlaceDTO: rawDtos.length === 1 ? rawDtos[0] : rawDtos,
      });
    }
  }
  return result;
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
  for (const [table, isActive] of [
    [ENDED_TABLE, false],
    [ACTIVE_TABLE, true],
  ] as const) {
    if (!snapshot.hasTable(table)) continue;
    const placesByRecord = loadPlacesByRecordStoreId(snapshot, table);
    for (const row of snapshot.queryAll(table)) {
      const storeId = asInt(row.store_id);
      const build = mapYoungEventRow(
        row,
        isActive,
        storeId == null ? undefined : placesByRecord.get(storeId),
      );
      if (build != null) merged.set(build.youngId, build);
    }
  }
  return [...merged.values()];
}
