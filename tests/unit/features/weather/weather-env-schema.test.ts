import { describe, expect, it } from "vitest";
import { commonEnvSchema } from "@/lib/env/env-schema";

describe("weather env schema", () => {
  it("accepts AMAP_API_KEY", () => {
    const result = commonEnvSchema.safeParse({ AMAP_API_KEY: "test-key" });
    expect(result.success).toBe(true);
    expect(result.data?.AMAP_API_KEY).toBe("test-key");
  });
});
