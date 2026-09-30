import { expect } from "@playwright/test";
import type { OAuthGrantUsageDaily } from "../../../src/generated/prisma-node/client";

export type OAuthUsageWindow = {
  start: number;
  end: number;
  operation: "read" | "write" | "write error";
};

/** The caller supplies all rows and independently specified operations/counts. */
export function expectOAuthUsage(
  rows: readonly Pick<
    OAuthGrantUsageDaily,
    | "userId"
    | "clientId"
    | "grantId"
    | "grantKey"
    | "feature"
    | "channel"
    | "day"
    | "readCount"
    | "writeCount"
    | "errorCount"
    | "lastUsedAt"
  >[],
  {
    dimensions,
    counts,
    windows,
  }: {
    dimensions: {
      userId: string;
      clientId: string | undefined;
      grantId: string | undefined;
      feature: string;
      channel: OAuthGrantUsageDaily["channel"];
    };
    counts: readonly [read: number, write: number, error: number];
    windows: readonly OAuthUsageWindow[];
  },
) {
  expect([
    rows.reduce((sum, row) => sum + row.readCount, 0),
    rows.reduce((sum, row) => sum + row.writeCount, 0),
    rows.reduce((sum, row) => sum + row.errorCount, 0),
  ]).toEqual(counts);
  expect(windows).toHaveLength(counts[0] + counts[1]);
  const day = (time: number) =>
    new Date(time + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
  // Independently enumerate each call's allowed Shanghai-day assignments.
  let assignments: string[][] = [[]];
  for (const { start, end } of windows)
    assignments = assignments.flatMap((assignment) =>
      [...new Set([day(start), day(end)])].map((date) => [...assignment, date]),
    );
  expect(
    assignments.some((assignment) => {
      const dates = [...new Set(assignment)].sort();
      return (
        dates.length === rows.length &&
        dates.every((date, index) => {
          const calls = windows.filter((_, call) => assignment[call] === date);
          const row = rows[index];
          const last = row.lastUsedAt.getTime();
          return (
            row.day.toISOString() === `${date}T00:00:00.000Z` &&
            row.readCount ===
              calls.filter((call) => call.operation === "read").length &&
            row.writeCount ===
              calls.filter((call) => call.operation.startsWith("write")).length &&
            row.errorCount ===
              calls.filter((call) => call.operation === "write error").length &&
            day(last) === date &&
            last >= Math.max(...calls.map(({ start }) => start)) &&
            last <= Math.max(...calls.map(({ end }) => end))
          );
        })
      );
    }),
  ).toBe(true);
  for (const row of rows)
    expect(row).toMatchObject({
      ...dimensions,
      grantKey: `grant:${dimensions.grantId}`,
    });
}
