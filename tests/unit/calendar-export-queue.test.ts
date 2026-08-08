import { afterEach, describe, expect, it, vi } from "vitest";
import {
  enqueueSectionCalendarExportRebuild,
  enqueueUserCalendarExportRebuild,
  parseCalendarExportRebuildMessage,
  setCalendarExportRebuildSenderForTest,
} from "@/features/calendar/server/calendar-export-queue";
import { setCloudflareRuntimeEnv } from "@/lib/adapters/cloudflare-runtime";

describe("calendar export rebuild queue helpers", () => {
  afterEach(() => {
    setCalendarExportRebuildSenderForTest(undefined);
    setCloudflareRuntimeEnv(undefined);
    vi.restoreAllMocks();
  });

  it("parses user and section messages and rejects invalid payloads", () => {
    expect(
      parseCalendarExportRebuildMessage({ type: "user", userId: "u1" }),
    ).toEqual({
      type: "user",
      userId: "u1",
    });
    expect(
      parseCalendarExportRebuildMessage({ type: "section", sectionId: 42 }),
    ).toEqual({ type: "section", sectionId: 42 });
    expect(
      parseCalendarExportRebuildMessage({ type: "user", userId: "" }),
    ).toBeNull();
    expect(
      parseCalendarExportRebuildMessage({ type: "section", sectionId: 0 }),
    ).toBeNull();
    expect(parseCalendarExportRebuildMessage(null)).toBeNull();
  });

  it("enqueues user and section rebuild messages through the test sender", async () => {
    const enqueued: unknown[] = [];
    setCalendarExportRebuildSenderForTest(async (message) => {
      enqueued.push(message);
    });

    await enqueueUserCalendarExportRebuild("user-1");
    await enqueueSectionCalendarExportRebuild(7);

    expect(enqueued).toEqual([
      { type: "user", userId: "user-1" },
      { type: "section", sectionId: 7 },
    ]);
  });

  it("sends through the Cloudflare Queue binding when no test sender is set", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    setCloudflareRuntimeEnv({
      CALENDAR_EXPORT_REBUILD: { send },
    });

    await enqueueUserCalendarExportRebuild("user-2");

    expect(send).toHaveBeenCalledWith({ type: "user", userId: "user-2" });
  });

  it("ignores empty user ids and non-positive section ids", async () => {
    const enqueued: unknown[] = [];
    setCalendarExportRebuildSenderForTest(async (message) => {
      enqueued.push(message);
    });

    await enqueueUserCalendarExportRebuild("   ");
    await enqueueSectionCalendarExportRebuild(-1);
    await enqueueSectionCalendarExportRebuild(1.5);

    expect(enqueued).toEqual([]);
  });
});
