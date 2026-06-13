export type BusImportPrisma = {
  busCampus: {
    upsert(args: unknown): Promise<unknown>;
  };
  busRoute: {
    upsert(args: unknown): Promise<unknown>;
  };
  busRouteStop: {
    createMany(args: unknown): Promise<unknown>;
    deleteMany(args: unknown): Promise<unknown>;
  };
  busScheduleVersion: {
    create(args: unknown): Promise<{ id: number; key: string }>;
    findFirst(args: unknown): Promise<{ id: number } | null>;
    update(args: unknown): Promise<{ id: number; key: string }>;
    updateMany(args: unknown): Promise<unknown>;
  };
  busTrip: {
    create(args: unknown): Promise<unknown>;
    deleteMany(args: unknown): Promise<unknown>;
  };
};
