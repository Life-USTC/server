import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  buildPaginatedResponse,
  normalizePagination,
  type PaginationInput,
} from "@/lib/pagination";

export type YoungOrganizerSummary = {
  id: string;
  name: string;
  normalizedName: string;
  totalCount: number;
  activeCount: number;
  upcomingCount: number;
  historyCount: number;
};
export type YoungOrganizerListInput = PaginationInput & {
  search?: string | null;
};
type OrganizerIdentity = Pick<
  YoungOrganizerSummary,
  "id" | "name" | "normalizedName"
>;
const selectOrganizer = { id: true, name: true, normalizedName: true } as const;

async function withEventCounts(
  organizers: OrganizerIdentity[],
): Promise<YoungOrganizerSummary[]> {
  if (organizers.length === 0) return [];
  const ids = organizers.map((organizer) => organizer.id);
  const now = new Date();
  const count = async (filter: Prisma.YoungEventWhereInput) => {
    const rows = await prisma.youngEvent.groupBy({
      by: ["organizerId"],
      where: { AND: [{ organizerId: { in: ids } }, filter] },
      _count: { _all: true },
    });
    return new Map(rows.map((row) => [row.organizerId, row._count._all]));
  };
  // These are independent facts, not partitions: an upcoming activity can also
  // be in the signup list. Missing times never imply historical activity.
  const [total, active, upcoming, history] = await Promise.all([
    count({}),
    count({ isActive: true }),
    count({ startAt: { gte: now } }),
    count({ endAt: { lte: now } }),
  ]);
  return organizers.map((organizer) => ({
    ...organizer,
    totalCount: total.get(organizer.id) ?? 0,
    activeCount: active.get(organizer.id) ?? 0,
    upcomingCount: upcoming.get(organizer.id) ?? 0,
    historyCount: history.get(organizer.id) ?? 0,
  }));
}

export async function listYoungOrganizers(input: YoungOrganizerListInput = {}) {
  const { page, pageSize, skip } = normalizePagination(input);
  const search = input.search?.trim();
  const where: Prisma.YoungOrganizerWhereInput = search
    ? { name: { contains: search, mode: "insensitive" } }
    : {};
  const [total, organizers] = await Promise.all([
    prisma.youngOrganizer.count({ where }),
    prisma.youngOrganizer.findMany({
      where,
      select: selectOrganizer,
      orderBy: [{ name: "asc" }, { id: "asc" }],
      skip,
      take: pageSize,
    }),
  ]);
  return buildPaginatedResponse(
    await withEventCounts(organizers),
    page,
    pageSize,
    total,
  );
}

export async function getYoungOrganizer(id: string) {
  const organizer = await prisma.youngOrganizer.findUnique({
    where: { id },
    select: selectOrganizer,
  });
  if (!organizer) return null;
  return (await withEventCounts([organizer]))[0];
}

/** Filter controls need identities only, without loading activity histories. */
export function listYoungOrganizerOptions() {
  return prisma.youngOrganizer.findMany({
    select: { id: true, name: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
}
