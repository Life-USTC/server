import { prisma } from "@/lib/db/prisma";
import { DEV_SEED, DEV_SEED_ANCHOR } from "../../../fixtures/dev-seed";

export { DEV_SEED, DEV_SEED_ANCHOR, prisma };

export const SEED_DATE = DEV_SEED_ANCHOR.date;
export const SEED_AT_TIME = DEV_SEED_ANCHOR.recommendedAtTime;
export const SEED_PLUS_THREE_DAYS = seedDatePlusDays(3);
export const SEED_PLUS_SIX_DAYS = seedDatePlusDays(6);
export const SEED_PLUS_SEVEN_DAYS = seedDatePlusDays(7);
export const SEED_PLUS_ELEVEN_DAYS = seedDatePlusDays(11);
export const SEED_PLUS_TWELVE_DAYS = seedDatePlusDays(12);
export const PAST_SAME_DAY_EXAM_JW_ID = 88_051_002;
export const UNKNOWN_DATE_EXAM_JW_ID = 88_051_003;

export function seedDatePlusDays(days: number) {
  const date = new Date(`${SEED_DATE}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function integrationUserEmail(prefix: string) {
  return `integration-${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`;
}

export function shanghaiIsoOnSeedDate(hhmm: number, addMinutes = 0) {
  const hours = Math.trunc(hhmm / 100);
  const minutes = hhmm % 100;
  const date = new Date(
    Date.parse(
      `${SEED_DATE}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00+08:00`,
    ) +
      addMinutes * 60_000,
  );
  return date
    .toLocaleString("sv-SE", {
      timeZone: "Asia/Shanghai",
      hour12: false,
    })
    .replace(" ", "T")
    .concat("+08:00");
}
