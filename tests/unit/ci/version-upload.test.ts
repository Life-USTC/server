import { describe, expect, it } from "vitest";
import { uploadedCandidate } from "../../../scripts/deploy/version-upload";

const commit = "a".repeat(40);
const version = "00000000-0000-4000-8000-000000000001";
const record = {
  type: "version-upload",
  version: 1,
  worker_name: "life-ustc",
  version_id: version,
};

describe("immutable uploaded candidate", () => {
  it("reads the single machine record and exact source identity", () => {
    expect(
      uploadedCandidate(
        `${JSON.stringify({ type: "diagnostic" })}\n${JSON.stringify(record)}\n`,
        commit,
        "life-ustc",
      ),
    ).toEqual({ commit, version });
  });

  it.each([
    "Uploaded version: looks-like-a-version",
    "",
    `${JSON.stringify(record)}\n${JSON.stringify(record)}`,
    JSON.stringify({ ...record, worker_name: "other-worker" }),
    JSON.stringify({ ...record, version: 2 }),
    JSON.stringify({ ...record, version_id: "not-a-version" }),
  ])("rejects ambiguous or mismatched upload evidence %#", (output) => {
    expect(() => uploadedCandidate(output, commit, "life-ustc")).toThrow();
  });
});
