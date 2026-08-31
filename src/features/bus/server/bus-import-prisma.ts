export type BusImportWritePrisma = {
  busCampus: {
    create(args: unknown): Promise<unknown>;
    updateMany(args: unknown): Promise<{ count: number }>;
  };
  busRoute: {
    create(args: unknown): Promise<unknown>;
    updateMany(args: unknown): Promise<{ count: number }>;
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
    createMany(args: unknown): Promise<unknown>;
    deleteMany(args: unknown): Promise<unknown>;
  };
};

export type BusImportPrisma = BusImportWritePrisma & {
  $transaction<Result>(
    callback: (tx: BusImportWritePrisma) => Promise<Result>,
  ): Promise<Result>;
};
