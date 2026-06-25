export type BusImportWritePrisma = {
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
    findUnique(
      args: unknown,
    ): Promise<{ id: number; key: string; checksum: string } | null>;
    update(args: unknown): Promise<{ id: number; key: string }>;
    updateMany(args: unknown): Promise<unknown>;
  };
  busTrip: {
    create(args: unknown): Promise<unknown>;
    deleteMany(args: unknown): Promise<unknown>;
  };
};

export type BusImportPrisma = BusImportWritePrisma & {
  $transaction<Result>(
    callback: (tx: BusImportWritePrisma) => Promise<Result>,
  ): Promise<Result>;
};
