import { describe, expect, it } from "vitest";
import { resolveAppVersionName } from "../../../../vite.config";

describe("application version name", () => {
  it("names the version after the commit the production build was created for", () => {
    const commit = "7191f4067868c2f57c0e89c6b9e2a4b08c3e86d6";
    expect(
      resolveAppVersionName({ WORKERS_CI_COMMIT_SHA: ` ${commit} ` }),
    ).toBe(commit);
  });

  it("keeps the build-time default when no build commit is available", () => {
    for (const environment of [
      {},
      { WORKERS_CI_COMMIT_SHA: "" },
      { WORKERS_CI_COMMIT_SHA: "7191f40" },
      { WORKERS_CI_COMMIT_SHA: "refs/heads/main" },
    ]) {
      expect(resolveAppVersionName(environment, () => "fallback")).toBe(
        "fallback",
      );
    }
  });
});
