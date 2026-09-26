import { describe, expect, it } from "vitest";
import { checkSpecifications } from "../../../scripts/specifications/validate";

describe("versioned YAML product specifications", () => {
  it("validates every source against its schema and checks references", async () => {
    const result = await checkSpecifications();
    expect(result.files).toBeGreaterThan(0);
    expect(result.requirements).toBeGreaterThan(0);
    expect(result.scenarios).toBeGreaterThan(0);
    expect(result.linkedScenarios).toBeGreaterThan(0);
    expect(result.errors).toEqual([]);
  });
});
