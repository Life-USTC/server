import { describe, expect, it } from "vitest";
import type { DemoView } from "@/features/demo/lib/demo-types";
import { globalSearchRequestContext } from "@/features/search/lib/global-search-owner";
import { layoutUserSummary } from "@/lib/shell/layout-server-data";
import type { ShellViewerState } from "@/lib/shell/shell-viewer";

const demo: DemoView = {
  fixtureVersion: "workspace-v1",
  expiresAt: 1_800_000_000_000,
  referenceNow: "2026-09-24T09:00:00+08:00",
  displayName: "Demo",
  readOnlyReason: "Read only",
  exitLabel: "Exit",
  unavailableReason: "Unavailable",
  referenceTimeLabel: "Sample time",
};
const anonymous: ShellViewerState = {
  viewer: null,
  demo: null,
  status: "ready",
};

describe("global search request ownership", () => {
  it("distinguishes anonymous and fictional scopes despite both having no real principal", () => {
    const ordinary = globalSearchRequestContext(anonymous, "en-us");
    const fictional = globalSearchRequestContext(
      { ...anonymous, demo },
      "en-us",
      demo,
    );
    expect(ordinary).toMatchObject({ enabled: true, includeWorkspace: false });
    expect(fictional).toMatchObject({
      enabled: true,
      includeWorkspace: true,
      expiresAt: demo.expiresAt,
    });
    expect(ordinary.ownerKey).not.toBe(fictional.ownerKey);
    expect(anonymous.viewer).toBeNull();
  });
  it("requires matching root/page Demo generations and retires unresolved or replaced roots", () => {
    for (const shell of [
      anonymous,
      { ...anonymous, demo, status: "loading" as const },
      { ...anonymous, demo: { ...demo, expiresAt: demo.expiresAt + 1 } },
    ])
      expect(globalSearchRequestContext(shell, "en-us", demo)).toMatchObject({
        enabled: false,
        includeWorkspace: false,
      });
    expect(
      globalSearchRequestContext({ ...anonymous, demo }, "en-us", {
        ...demo,
        fixtureVersion: "old" as "workspace-v1",
      }),
    ).toMatchObject({ enabled: false, includeWorkspace: false });
  });
  it("waits for a real viewer before private scope and keeps real owners distinct", () => {
    const a = { ...anonymous, viewer: layoutUserSummary({ id: "real-a" }) };
    const b = { ...anonymous, viewer: layoutUserSummary({ id: "real-b" }) };
    expect(globalSearchRequestContext(a, "en-us")).toMatchObject({
      enabled: true,
      includeWorkspace: true,
    });
    expect(
      globalSearchRequestContext({ ...a, status: "loading" }, "en-us")
        .includeWorkspace,
    ).toBe(false);
    expect(globalSearchRequestContext(a, "en-us").ownerKey).not.toBe(
      globalSearchRequestContext(b, "en-us").ownerKey,
    );
    expect(globalSearchRequestContext(a, "zh-cn").locale).toBe("zh-cn");
  });
});
