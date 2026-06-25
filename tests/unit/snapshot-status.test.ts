import { assertNoSnapshotErrors } from "@tools/dev/artifacts/snapshots/artifact-utils";
import { httpSnapshotError } from "@tools/dev/artifacts/snapshots/snapshot-status";
import { describe, expect, it } from "vitest";

describe("snapshot HTTP status handling", () => {
  it("marks unexpected 500 page responses as capture errors", () => {
    const error = httpSnapshotError({
      expectedStatus: undefined,
      ok: false,
      status: 500,
    });

    expect(error).toBe("Unexpected HTTP 500");
    expect(() =>
      assertNoSnapshotErrors("pages", [{ id: "broken-page", error }]),
    ).toThrow(
      "pages snapshot capture failed:\nbroken-page: Unexpected HTTP 500",
    );
  });

  it("allows explicitly expected non-2xx statuses", () => {
    expect(
      httpSnapshotError({ expectedStatus: 404, ok: false, status: 404 }),
    ).toBeUndefined();
  });

  it("fails when an expected status does not match the response", () => {
    expect(
      httpSnapshotError({ expectedStatus: 404, ok: true, status: 200 }),
    ).toBe("Expected HTTP 404, received 200");
  });
});
