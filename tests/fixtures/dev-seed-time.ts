import { DEV_SEED_ANCHOR } from "./dev-seed";

const SHANGHAI_UTC_OFFSET_HOURS = 8;
const MS_PER_HOUR = 60 * 60 * 1000;

const [SEED_ANCHOR_YEAR, SEED_ANCHOR_MONTH, SEED_ANCHOR_DAY] =
  DEV_SEED_ANCHOR.date.split("-").map(Number) as [number, number, number];

export function makeShanghaiSeedDateAt(
  hour: number,
  minute: number,
  offsetDays = 0,
) {
  return new Date(
    Date.UTC(
      SEED_ANCHOR_YEAR,
      SEED_ANCHOR_MONTH - 1,
      SEED_ANCHOR_DAY + offsetDays,
      hour - SHANGHAI_UTC_OFFSET_HOURS,
      minute,
      0,
      0,
    ),
  );
}

export function makeSeedDateOnly(offsetDays = 0) {
  return new Date(
    Date.UTC(
      SEED_ANCHOR_YEAR,
      SEED_ANCHOR_MONTH - 1,
      SEED_ANCHOR_DAY + offsetDays,
    ),
  );
}

export function toShanghaiWeekday(date: Date) {
  const day = new Date(
    date.getTime() + SHANGHAI_UTC_OFFSET_HOURS * MS_PER_HOUR,
  ).getUTCDay();
  return day === 0 ? 7 : day;
}
