import { describe, expect, it } from "vitest";
import type { BusStaticPayload } from "@/features/bus/lib/bus-types";
import { importBusStaticPayload } from "@/features/bus/server/bus-import";
import type {
  BusImportPrisma,
  BusImportWritePrisma,
} from "@/features/bus/server/bus-import-prisma";

type VersionRow = {
  id: number;
  key: string;
  title: string;
  checksum: string;
  rawJson: unknown;
  isEnabled: boolean;
};

type TripRow = {
  versionId: number;
  routeId: number;
  dayType: "weekday" | "weekend";
  position: number;
  stopTimes: Array<string | null>;
};

type ImportState = {
  nextVersionId: number;
  versions: VersionRow[];
  trips: TripRow[];
};

type ImportPrismaMock = BusImportPrisma & {
  getState(): ImportState;
};

function cloneState(state: ImportState): ImportState {
  return structuredClone(state);
}

function createImportPrismaMock(
  initialState: ImportState,
  options: { failTripCreate?: boolean } = {},
): ImportPrismaMock {
  let state = cloneState(initialState);

  const createDelegates = (target: ImportState): BusImportWritePrisma => ({
    busCampus: {
      async upsert() {
        return {};
      },
    },
    busRoute: {
      async upsert() {
        return {};
      },
    },
    busRouteStop: {
      async createMany() {
        return {};
      },
      async deleteMany() {
        return {};
      },
    },
    busScheduleVersion: {
      async create(args) {
        const data = (args as { data: Omit<VersionRow, "id"> }).data;
        const version = { id: target.nextVersionId, ...data };
        target.nextVersionId += 1;
        target.versions.push(version);
        return { id: version.id, key: version.key };
      },
      async findFirst(args) {
        const filters = (
          args as { where: { OR: Array<{ checksum?: string; key?: string }> } }
        ).where.OR;
        const version =
          target.versions.find((candidate) =>
            filters.some(
              (filter) =>
                filter.key === candidate.key ||
                filter.checksum === candidate.checksum,
            ),
          ) ?? null;
        return version ? { id: version.id } : null;
      },
      async update(args) {
        const input = args as {
          where: { id: number };
          data: Partial<VersionRow>;
        };
        const version = target.versions.find(
          (candidate) => candidate.id === input.where.id,
        );
        if (!version) throw new Error("version not found");
        Object.assign(version, input.data);
        return { id: version.id, key: version.key };
      },
      async updateMany(args) {
        const input = args as {
          where: { id: { not: number } } | { key: { not: string } };
          data: Partial<VersionRow>;
        };
        for (const version of target.versions) {
          if ("id" in input.where && version.id === input.where.id.not) {
            continue;
          }
          if ("key" in input.where && version.key === input.where.key.not) {
            continue;
          }
          Object.assign(version, input.data);
        }
        return {};
      },
    },
    busTrip: {
      async create(args) {
        if (options.failTripCreate) {
          throw new Error("injected trip write failure");
        }
        const data = (args as { data: TripRow }).data;
        target.trips.push(data);
        return {};
      },
      async deleteMany(args) {
        const versionId = (args as { where: { versionId: number } }).where
          .versionId;
        target.trips = target.trips.filter(
          (trip) => trip.versionId !== versionId,
        );
        return {};
      },
    },
  });

  const root = {
    ...createDelegates(state),
    async $transaction<Result>(
      callback: (tx: BusImportWritePrisma) => Promise<Result>,
    ) {
      const transactionState = cloneState(state);
      const result = await callback(createDelegates(transactionState));
      state = transactionState;
      return result;
    },
    getState() {
      return state;
    },
  };

  return root;
}

function createPayload(): BusStaticPayload {
  const east = { id: 1, name: "东区", latitude: 31.1, longitude: 117.1 };
  const west = { id: 2, name: "西区", latitude: 31.2, longitude: 117.2 };
  const route = { id: 8, campuses: [east, west] };

  return {
    campuses: [east, west],
    routes: [route],
    weekday_routes: [{ id: 1, route, time: [["08:00", "08:20"]] }],
    weekend_routes: [],
    message: { message: "2026 春校车时刻表", url: "https://example.test" },
  };
}

describe("bus schedule imports", () => {
  it("keeps the active timetable intact when replacement trip writes fail", async () => {
    const initialState: ImportState = {
      nextVersionId: 2,
      versions: [
        {
          id: 1,
          key: "current-bus",
          title: "Current bus schedule",
          checksum: "old-checksum",
          rawJson: { old: true },
          isEnabled: true,
        },
      ],
      trips: [
        {
          versionId: 1,
          routeId: 8,
          dayType: "weekday",
          position: 0,
          stopTimes: ["07:30", "07:50"],
        },
      ],
    };
    const prisma = createImportPrismaMock(initialState, {
      failTripCreate: true,
    });

    await expect(
      importBusStaticPayload(prisma, createPayload(), {
        versionKey: "current-bus",
      }),
    ).rejects.toThrow("injected trip write failure");

    expect(prisma.getState()).toEqual(initialState);
  });
});
