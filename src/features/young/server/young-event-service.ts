import type { Prisma } from "@/generated/prisma/client";
import {
  buildPaginatedResponse,
  normalizePagination,
  type PaginatedResponse,
  type PaginationInput,
} from "@/lib/api/pagination";
import { prisma } from "@/lib/db/prisma";
import { formatShanghaiTimestamp } from "@/lib/time/shanghai-format";

export type YoungEventSummary = {
  youngId: string;
  name: string;
  category: string | null;
  department: string | null;
  organizer: string | null;
  status: string | null;
  registrationStatus: string | null;
  location: string | null;
  imageUrl: string | null;
  hours: number | null;
  capacity: number | null;
  appliedCount: number | null;
  startAt: string | null;
  endAt: string | null;
  applyStartAt: string | null;
  applyEndAt: string | null;
  isActive: boolean;
};

export type YoungEventDetail = YoungEventSummary & {
  rawJson: Prisma.JsonValue;
};

export type YoungEventListInput = PaginationInput & {
  active?: boolean | null;
  category?: string | null;
  search?: string | null;
};

const YOUNG_EVENT_SELECT = {
  youngId: true,
  name: true,
  category: true,
  department: true,
  organizer: true,
  status: true,
  registrationStatus: true,
  location: true,
  imageUrl: true,
  hours: true,
  capacity: true,
  appliedCount: true,
  startAt: true,
  endAt: true,
  applyStartAt: true,
  applyEndAt: true,
  isActive: true,
} satisfies Prisma.YoungEventSelect;

type YoungEventRecord = Prisma.YoungEventGetPayload<{
  select: typeof YOUNG_EVENT_SELECT;
}>;

function toShanghaiIso(date: Date | null): string | null {
  return date == null ? null : formatShanghaiTimestamp(date);
}

function toYoungEventSummary(record: YoungEventRecord): YoungEventSummary {
  return {
    youngId: record.youngId,
    name: record.name,
    category: record.category,
    department: record.department,
    organizer: record.organizer,
    status: record.status,
    registrationStatus: record.registrationStatus,
    location: record.location,
    imageUrl: record.imageUrl,
    hours: record.hours,
    capacity: record.capacity,
    appliedCount: record.appliedCount,
    startAt: toShanghaiIso(record.startAt),
    endAt: toShanghaiIso(record.endAt),
    applyStartAt: toShanghaiIso(record.applyStartAt),
    applyEndAt: toShanghaiIso(record.applyEndAt),
    isActive: record.isActive,
  };
}

export async function listYoungEvents(
  input: YoungEventListInput = {},
): Promise<PaginatedResponse<YoungEventSummary>> {
  const { page, pageSize, skip } = normalizePagination(input);

  const where: Prisma.YoungEventWhereInput = {};
  if (input.active != null) where.isActive = input.active;
  const category = input.category?.trim();
  if (category) where.category = category;
  const search = input.search?.trim();
  if (search) where.name = { contains: search, mode: "insensitive" };

  const [total, records] = await Promise.all([
    prisma.youngEvent.count({ where }),
    prisma.youngEvent.findMany({
      where,
      select: YOUNG_EVENT_SELECT,
      // Signup-open events first, then most recent start time.
      orderBy: [
        { isActive: "desc" },
        { startAt: { sort: "desc", nulls: "last" } },
        { youngId: "asc" },
      ],
      skip,
      take: pageSize,
    }),
  ]);

  return buildPaginatedResponse(
    records.map(toYoungEventSummary),
    page,
    pageSize,
    total,
  );
}

export async function getYoungEvent(
  youngId: string,
): Promise<YoungEventDetail | null> {
  const record = await prisma.youngEvent.findUnique({
    where: { youngId },
    select: { ...YOUNG_EVENT_SELECT, rawJson: true },
  });
  if (record == null) return null;
  const { rawJson, ...summaryRecord } = record;
  return { ...toYoungEventSummary(summaryRecord), rawJson };
}

export async function listYoungEventCategories(): Promise<string[]> {
  const rows = await prisma.youngEvent.findMany({
    where: { category: { not: null } },
    select: { category: true },
    distinct: ["category"],
    orderBy: { category: "asc" },
  });
  return rows
    .map((row) => row.category)
    .filter((category): category is string => category != null);
}
