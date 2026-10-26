import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { checkOpenApiDocument } from "../../../../scripts/openapi/generate";

const document = {
  openapi: "3.1.0",
  info: { title: "Test API", version: "1.0.0" },
  paths: {},
};

describe("OpenAPI artifact check", () => {
  let directory: string;
  let artifact: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "openapi-artifact-"));
    artifact = join(directory, "openapi.generated.json");
  });

  afterEach(() => rmSync(directory, { recursive: true, force: true }));

  it("accepts a current snapshot outside a Git repository", () => {
    const snapshot = `${JSON.stringify(document, null, 2)}\n`;
    writeFileSync(artifact, snapshot);
    expect(checkOpenApiDocument(document, artifact)).toBe(true);
    expect(readFileSync(artifact, "utf8")).toBe(snapshot);
  });

  it("rejects stale content without replacing it", () => {
    const stale = '{"openapi":"3.0.0"}\n';
    writeFileSync(artifact, stale);
    expect(checkOpenApiDocument(document, artifact)).toBe(false);
    expect(readFileSync(artifact, "utf8")).toBe(stale);
  });

  it("rejects a missing snapshot without creating it", () => {
    expect(checkOpenApiDocument(document, artifact)).toBe(false);
    expect(existsSync(artifact)).toBe(false);
  });
});
