import { DEMO_REFERENCE_NOW } from "@/features/demo/lib/demo-types";
import {
  DEMO_YOUNG_IDS,
  DEMO_YOUNG_ORGANIZER_IDS,
} from "@/features/demo/lib/demo-young-ids";
import { youngEventConflictIntervals } from "@/features/young/lib/young-event-conflict-intervals";
import {
  youngEventNumberFields,
  youngOrganizerNumberFields,
} from "@/features/young/lib/young-table-filters";
import { buildYoungEventListQuery } from "@/features/young/server/young-event-query";
import type {
  YoungCalendarEvent,
  YoungEventDetail,
  YoungEventListInput,
  YoungEventPage,
  YoungEventSummary,
  YoungOrganizerListInput,
  YoungOrganizerSummary,
  YoungSourceFreshness,
} from "@/features/young/server/young-event-service";
import type { AppLocale } from "@/i18n/config";
import { buildPaginatedResponse, normalizePagination } from "@/lib/pagination";
import { matchTableFilter, tableFilterValues } from "@/lib/table-filters";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";

const source = (): YoungSourceFreshness => ({
  status: "unknown",
  lastSyncedAt: null,
});
const titles = {
  "en-us": [
    "Fictional algebra discussion",
    "Fictional physics reading",
    "Fictional programming workshop",
    "Fictional study exchange",
    "Fictional science sketching",
  ],
  "zh-cn": [
    "虚构代数讨论",
    "虚构物理共读",
    "虚构编程工作坊",
    "虚构学习交流",
    "虚构科学速写",
  ],
} as const;
const stamp = (days: number, time = "08:30:00") =>
  `${shanghaiDayjs(DEMO_REFERENCE_NOW).add(days, "day").format("YYYY-MM-DD")}T${time}+08:00`;
const organizerName = (locale: AppLocale, number: number) =>
  locale === "en-us"
    ? `Fictional study circle ${String(number).padStart(2, "0")}`
    : `虚构学习小组 ${String(number).padStart(2, "0")}`;

/** Sealed bilingual graph. Source freshness stays unknown: no collector ran. */
export function getDemoYoungRecords(locale: AppLocale): YoungEventDetail[] {
  const english = locale === "en-us";
  return DEMO_YOUNG_IDS.map((youngId, index) => {
    const number = index + 1;
    const organizer = index < 22 ? 1 : index - 20;
    const startAt =
      number === 7
        ? null
        : number === 11
          ? stamp(-7)
          : number === 28
            ? stamp(0, "09:30:00")
            : stamp(index < 5 ? index : index % 14);
    const endAt =
      startAt == null
        ? null
        : number === 28
          ? stamp(0, "10:30:00")
          : number === 9
            ? stamp((index % 14) + 1, "10:30:00")
            : number === 11
              ? stamp(-7, "09:30:00")
              : `${startAt.slice(0, 10)}T09:30:00+08:00`;
    const categoryCode = index % 2 === 0 ? "0" : "1";
    const record: YoungEventDetail = {
      youngId,
      name:
        titles[locale][index] ??
        (english
          ? `Fictional activity ${String(number).padStart(2, "0")}`
          : `虚构活动 ${String(number).padStart(2, "0")}`),
      category: categoryCode === "0" ? "单次项目" : "系列项目",
      department: english ? "Fictional learning group" : "虚构学习团体",
      organizer: organizerName(locale, organizer),
      organizerId: `demo-young-organizer-${organizer}`,
      status: null,
      activityStatusCode: null,
      signupStatusCode: null,
      requiresSignup: number !== 13,
      categoryCode,
      moduleCode: null,
      formCode: "0",
      activityLevelCode: null,
      departmentId: null,
      upstreamOrganizerIds: [],
      upstreamSponsorIds: [],
      tagIds: [],
      signupScopeCode: null,
      signupDepartmentIds: [],
      requiresSignupInfo: false,
      allowedAttachmentTypes: [],
      isOnline: false,
      onlineMeetingInfo: null,
      externalSponsor: null,
      location: english
        ? `Fictional sample room ${number}`
        : `虚构样例教室 ${number}`,
      imageUrl: "/api/catalog/young-events/images/demo-young-poster.png",
      hours: 1,
      capacity: 20 + index,
      appliedCount: index,
      startAt,
      endAt,
      applyStartAt:
        number === 8 || number === 13
          ? null
          : number === 28
            ? stamp(0, "08:00:00")
            : stamp(number === 6 ? 3 : -3, "09:00:00"),
      applyEndAt:
        number === 8 || number === 13
          ? null
          : number === 28
            ? stamp(0, "09:15:00")
            : stamp(number === 12 ? -1 : number === 6 ? 5 : 2, "18:00:00"),
      isActive: number !== 10 && number < 33,
      sourceMissing: number === 9,
      lastSeenAt: null,
      createdAt: number === 28 ? stamp(-1, "14:00:00") : null,
      activityLevel: index % 2 === 0 ? "校级" : "院级",
      module: ["德", "智", "体", "美", "劳"][index % 5] ?? "智",
      form: "现场参与",
      grades: null,
      sponsor: null,
      contactName: null,
      contactTel: null,
      duration: 1,
      serviceHour: null,
      sumHours: null,
      sumPersons: null,
      partakeNum: null,
      favCount: index % 4,
      limitNum: 20 + index,
      createdAtUpstream: null,
      auditedAt: null,
      updatedAtUpstream: null,
      places: null,
      description: english
        ? `<p><strong>Fixed fictional sample — not a school activity.</strong></p><p>${titles[locale][index] ?? `Fictional activity ${number}`}. Discuss the sample exercise in a read-only demonstration.</p>`
        : `<p><strong>固定虚构样例——并非学校活动。</strong></p><p>${titles[locale][index] ?? `虚构活动 ${number}`}。在只读演示中讨论样例练习。</p>`,
      participationNotes: english
        ? "Fictional signup only. No external registration or real attendance is available."
        : "仅为虚构报名样例，不提供外部报名或真实参与。",
      rawJson: {
        fictional: true,
        fixtureVersion: "workspace-v1",
        sample: number,
      },
    };
    record.conflictIntervals = youngEventConflictIntervals(record);
    return record;
  });
}

export function getDemoYoungEvent(locale: AppLocale, id: string) {
  return (
    getDemoYoungRecords(locale).find((event) => event.youngId === id) ?? null
  );
}

function tableMatch(
  event: YoungEventDetail,
  values: Record<string, string>,
  labels?: YoungEventListInput["tableStatusLabels"],
) {
  for (const name of ["search", "location"] as const) {
    if (
      !matchTableFilter(
        name === "search" ? event.name : event.location,
        { name, label: name },
        values,
      )
    )
      return false;
  }
  if (values.status) {
    const label =
      event.status ||
      (event.isActive ? labels?.statusOpen : labels?.statusClosed) ||
      "";
    if (!label.toLocaleLowerCase().includes(values.status.toLocaleLowerCase()))
      return false;
  }
  for (const name of [
    "category",
    "module",
    "activityLevel",
    "organizerId",
    "active",
  ] as const) {
    const selected = tableFilterValues(values[name]).map((value) =>
      name === "category" ? decodeURIComponent(value) : value,
    );
    const actual = name === "active" ? String(event.isActive) : event[name];
    if (selected.length && !selected.includes(actual ?? "")) return false;
  }
  for (const name of youngEventNumberFields)
    if (
      !matchTableFilter(
        event[name],
        { name, label: name, type: "number" },
        values,
      )
    )
      return false;
  return matchTableFilter(
    event.startAt?.slice(0, 10),
    { name: "startAt", label: "startAt", type: "date" },
    values,
  );
}

function selectEvents(locale: AppLocale, input: YoungEventListInput) {
  const query = buildYoungEventListQuery(input);
  const base = getDemoYoungRecords(locale).filter((event) => {
    if (input.tableFilters)
      return tableMatch(event, input.tableFilters, input.tableStatusLabels);
    const filters = query.filters;
    return (
      (filters.active == null || event.isActive === filters.active) &&
      (["category", "module", "activityLevel", "organizerId"] as const).every(
        (name) => !filters[name] || event[name] === filters[name],
      ) &&
      (!filters.search ||
        event.name
          .toLocaleLowerCase()
          .includes(filters.search.toLocaleLowerCase()))
    );
  });
  const both =
    input.tableFilters != null &&
    (!input.tableFilters.timeBasis ||
      input.tableFilters.timeBasis.includes(","));
  const start =
    query.dateRange.timeBasis === "registration" ? "applyStartAt" : "startAt";
  const end =
    query.dateRange.timeBasis === "registration" ? "applyEndAt" : "endAt";
  const unknown = (event: YoungEventDetail) =>
    both
      ? event.startAt == null || event.applyStartAt == null
      : event[start] == null;
  const rows = base.filter((event) => {
    if (input.dateUnknown) return unknown(event);
    if (query.hasRange) {
      const from = query.dateRange.from?.getTime(),
        to = query.dateRange.to?.getTime();
      const at = event[start] == null ? NaN : Date.parse(event[start]);
      const ends = event[end] == null ? NaN : Date.parse(event[end]);
      return (
        Number.isFinite(at) &&
        (to == null || at <= to) &&
        (from == null || ends > from || at >= from)
      );
    }
    if (input.dateUnknown === false)
      return both
        ? event.startAt != null || event.applyStartAt != null
        : !unknown(event);
    return true;
  });
  rows.sort((a, b) =>
    query.hasRange
      ? (a[start] ?? "").localeCompare(b[start] ?? "") ||
        a.youngId.localeCompare(b.youngId)
      : Number(b.isActive) - Number(a.isActive) ||
        (a.startAt == null
          ? b.startAt == null
            ? 0
            : 1
          : b.startAt == null
            ? -1
            : b.startAt.localeCompare(a.startAt)) ||
        a.youngId.localeCompare(b.youngId),
  );
  return {
    rows,
    unknownDateCount: query.hasRange ? base.filter(unknown).length : 0,
  };
}

export function getDemoYoungEvents(
  locale: AppLocale,
  input: YoungEventListInput = {},
): YoungEventPage {
  const { page, pageSize, skip } = normalizePagination(input);
  const { rows, unknownDateCount } = selectEvents(locale, input);
  const summaries: YoungEventSummary[] = rows
    .slice(skip, skip + pageSize)
    .map(
      ({
        description: _description,
        participationNotes: _notes,
        rawJson: _raw,
        ...event
      }) => event,
    );
  return {
    ...buildPaginatedResponse(summaries, page, pageSize, rows.length),
    unknownDateCount,
    source: source(),
  };
}

export function getDemoYoungCalendar(
  locale: AppLocale,
  input: YoungEventListInput,
) {
  const { rows, unknownDateCount } = selectEvents(locale, input);
  const data: YoungCalendarEvent[] = rows.map(
    ({
      youngId,
      name,
      startAt,
      endAt,
      applyStartAt,
      applyEndAt,
      location,
      sourceMissing,
      conflictIntervals,
    }) => ({
      youngId,
      name,
      startAt,
      endAt,
      applyStartAt,
      applyEndAt,
      location,
      sourceMissing,
      conflictIntervals,
    }),
  );
  return { data, unknownDateCount, source: source() };
}

function organizers(locale: AppLocale): YoungOrganizerSummary[] {
  const events = getDemoYoungRecords(locale),
    now = Date.parse(DEMO_REFERENCE_NOW);
  return DEMO_YOUNG_ORGANIZER_IDS.map((id, index) => {
    const records = events.filter((event) => event.organizerId === id);
    const name = organizerName(locale, index + 1);
    return {
      id,
      name,
      normalizedName: name.toLocaleLowerCase(),
      totalCount: records.length,
      activeCount: records.filter((event) => event.isActive).length,
      upcomingCount: records.filter(
        (event) => event.startAt != null && Date.parse(event.startAt) >= now,
      ).length,
      historyCount: records.filter(
        (event) => event.endAt != null && Date.parse(event.endAt) <= now,
      ).length,
    };
  });
}
export function getDemoYoungOrganizers(
  locale: AppLocale,
  input: YoungOrganizerListInput = {},
) {
  const { page, pageSize, skip } = normalizePagination(input);
  const rows = organizers(locale).filter(
    (organizer) =>
      (!input.search?.trim() ||
        organizer.name
          .toLocaleLowerCase()
          .includes(input.search.trim().toLocaleLowerCase())) &&
      youngOrganizerNumberFields.every((name) =>
        matchTableFilter(
          organizer[name],
          { name, label: name, type: "number" },
          input.tableFilters ?? {},
        ),
      ),
  );
  rows.sort(
    (a, b) =>
      (input.activeFirst
        ? Number(b.activeCount > 0) - Number(a.activeCount > 0)
        : 0) ||
      a.name.localeCompare(b.name) ||
      a.id.localeCompare(b.id),
  );
  return buildPaginatedResponse(
    rows.slice(skip, skip + pageSize),
    page,
    pageSize,
    rows.length,
  );
}
export function getDemoYoungOrganizer(locale: AppLocale, id: string) {
  return organizers(locale).find((organizer) => organizer.id === id) ?? null;
}
export function getDemoYoungOrganizerOptions(locale: AppLocale) {
  return organizers(locale)
    .map(({ id, name }) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}
export function getDemoYoungSource() {
  return source();
}
export function getDemoYoungHomeActivities(locale: AppLocale) {
  return getDemoYoungRecords(locale)
    .slice(0, 5)
    .map((event, index) => ({
      key: `demo-home-activity-${index + 1}`,
      href: `/catalog/young-events/${event.youngId}`,
      title: event.name,
      meta:
        locale === "en-us"
          ? "Fictional demo sample · Not a public event"
          : "虚构演示样例 · 非真实公开活动",
      dateLabel: event.startAt?.slice(0, 10) ?? "",
      crossDay: false,
    }));
}

const subscribedEventNumbers = new Set([
  1,
  9,
  ...Array.from({ length: 19 }, (_, index) => index + 24),
]);

/** Fixed fictional membership shared by public and workspace projections, never a principal. */
export function getDemoYoungSubscriptionFacts(
  kind: "events" | "organizers",
  id: string,
) {
  const allowed = kind === "events" ? DEMO_YOUNG_IDS : DEMO_YOUNG_ORGANIZER_IDS;
  if (!allowed.includes(id)) return null;
  return {
    subscribed:
      kind === "events"
        ? subscribedEventNumbers.has(DEMO_YOUNG_IDS.indexOf(id) + 1)
        : DEMO_YOUNG_ORGANIZER_IDS.indexOf(id) < 21,
    ...(kind === "events"
      ? {
          remindSignup: true,
          remindDeadline: id === "demo-young-28",
          remindStart: true,
        }
      : {}),
  };
}
