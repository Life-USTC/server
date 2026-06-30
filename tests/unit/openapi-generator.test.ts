import { describe, expect, it } from "vitest";
import { generateOpenApiDocument } from "../../scripts/openapi/generate";

describe("openapi generator", () => {
  it("returns a document with the generated metadata", () => {
    const doc = generateOpenApiDocument();
    expect(doc.openapi).toBe("3.0.0");
    expect(doc.info.title).toBe("Life@USTC API");
    expect(doc.info.version).toBe("1.0.0");
    expect(doc.info.description).toBe(
      "OpenAPI document generated from SvelteKit route handlers",
    );
    expect(doc.servers).toEqual([{ url: "/", description: "Current origin" }]);
    expect(doc.components?.securitySchemes).toBeDefined();
    expect(doc.components?.schemas).toBeDefined();
  });
});
