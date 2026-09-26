import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  parseSpecificationYaml,
  readSpecification,
} from "../../../scripts/specifications/yaml";

describe("specification YAML input contract", () => {
  it("preserves literal requirement text, ordering and JSON-compatible values", () => {
    expect(
      parseSpecificationYaml(
        `
id: homework
enabled: true
count: 2
ratio: 1.25
empty: null
date: 2026-09-15
names: [code, name]
rule: |-
  First line.
  Second line.
`,
        "feature.yaml",
      ),
    ).toEqual({
      id: "homework",
      enabled: true,
      count: 2,
      ratio: 1.25,
      empty: null,
      date: "2026-09-15",
      names: ["code", "name"],
      rule: "First line.\nSecond line.",
    });
  });

  it("uses YAML 1.2 scalar rules without silently applying YAML 1.1", () => {
    expect(
      parseSpecificationYaml(
        "%YAML 1.2\n---\non: off\nyes: no\n",
        "feature.yaml",
      ),
    ).toEqual({ on: "off", yes: "no" });
  });

  it.each([
    ["id: a\nid: b", "unique"],
    ["id: a\n---\nid: b", "one YAML document"],
    ["", "one YAML document"],
    ["[a, b]", "root must be a mapping"],
    ["1: value", "keys must be strings"],
    ["true: value", "keys must be strings"],
    ["? [a, b]\n: value", "keys must be strings"],
    ["id: &shared value", "anchors"],
    ["id: *shared", "aliases"],
    ["<<: { id: value }", "merge keys"],
    ["id: !!str value", "explicit tags"],
    ["id: !custom value", "tag"],
    ["%TAG !x! tag:example.test,2026:\n---\nid: value", "tag directives"],
    ["%YAML 1.1\n---\nid: value", "YAML 1.2"],
    ["number: .nan", "finite"],
    ["number: .inf", "finite"],
    ["number: 9007199254740993", "exact integer range"],
  ])("rejects ambiguous or unsupported source %s", (text, message) => {
    expect(() => parseSpecificationYaml(text, "invalid.yaml")).toThrow(message);
    expect(() => parseSpecificationYaml(text, "invalid.yaml")).toThrow(
      "invalid.yaml",
    );
  });
});

describe("specification file boundaries", () => {
  const directories: string[] = [];
  afterEach(async () => {
    await Promise.all(
      directories
        .splice(0)
        .map((directory) => rm(directory, { recursive: true, force: true })),
    );
  });

  it("rejects test or document references resolving outside the repository", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-root-"));
    const outside = await mkdtemp(join(tmpdir(), "spec-outside-"));
    directories.push(root, outside);
    await writeFile(join(outside, "outside.yaml"), "id: outside\n");
    await symlink(join(outside, "outside.yaml"), join(root, "linked.yaml"));
    await expect(readSpecification("linked.yaml", root)).rejects.toThrow(
      "escapes the repository",
    );
    await expect(
      readSpecification(join(outside, "outside.yaml"), root),
    ).rejects.toThrow("repository-relative");
  });
});
