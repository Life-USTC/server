import { describe, expect, it } from "vitest";
import { generateOpenApiDocument } from "../../scripts/openapi/generate";

describe("openapi generator", () => {
  it("returns a document with the base metadata", () => {
    const doc = generateOpenApiDocument();
    expect(doc.openapi).toBe("3.0.0");
    expect(doc.info.title).toBe("Life@USTC API");
    expect(doc.info.version).toBe("0.1.0");
    expect(doc.info.description).toBe("USTC Life REST API");
    expect(doc.servers).toEqual([{ url: "/", description: "Current host" }]);
  });
});
