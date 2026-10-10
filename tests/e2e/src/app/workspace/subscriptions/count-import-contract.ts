import { expect } from "@playwright/test";
import type { CalendarBrowserWriteVerifier } from "../../../../utils/calendar-protocol-lifecycle";

export function verifyCountImport(count: number): CalendarBrowserWriteVerifier {
  return async (response, incoming) => {
    expect(incoming.method()).toBe("POST");
    expect([
      "/api/workspace/subscriptions/query",
      "/api/workspace/subscriptions/batch",
    ]).toContain(new URL(incoming.url()).pathname);
    expect(response.status()).toBe(200);
    const body = await response.json();
    if (new URL(incoming.url()).pathname.endsWith("/batch"))
      expect(body).toMatchObject({
        addedCount: count,
        removedCount: 0,
        unchangedCount: 0,
      });
  };
}
