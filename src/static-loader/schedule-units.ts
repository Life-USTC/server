const OFFICIAL_PERIODS = [
  { unit: 1, startTime: 750, endTime: 835 },
  { unit: 2, startTime: 840, endTime: 925 },
  { unit: 3, startTime: 945, endTime: 1030 },
  { unit: 4, startTime: 1035, endTime: 1120 },
  { unit: 5, startTime: 1125, endTime: 1210 },
  { unit: 6, startTime: 1400, endTime: 1445 },
  { unit: 7, startTime: 1450, endTime: 1535 },
  { unit: 8, startTime: 1555, endTime: 1640 },
  { unit: 9, startTime: 1645, endTime: 1730 },
  { unit: 10, startTime: 1735, endTime: 1820 },
  { unit: 11, startTime: 1930, endTime: 2015 },
  { unit: 12, startTime: 2020, endTime: 2105 },
  { unit: 13, startTime: 2110, endTime: 2155 },
] as const;

const START_UNIT_BY_TIME = new Map(
  OFFICIAL_PERIODS.map(({ startTime, unit }) => [startTime, unit]),
);
const END_UNIT_BY_TIME = new Map(
  OFFICIAL_PERIODS.map(({ endTime, unit }) => [endTime, unit]),
);

export type ScheduleUnits = {
  startUnit: number;
  endUnit: number;
};

export function deriveScheduleUnits(
  startTime: number,
  endTime: number,
): ScheduleUnits {
  const startUnit = START_UNIT_BY_TIME.get(startTime);
  const endUnit = END_UNIT_BY_TIME.get(endTime);

  if (startUnit == null || endUnit == null || startUnit > endUnit) {
    return { startUnit: 0, endUnit: 0 };
  }

  return { startUnit, endUnit };
}
