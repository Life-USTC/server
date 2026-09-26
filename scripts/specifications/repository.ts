import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { readSpecification, repositoryRoot } from "./yaml";

export type TestReference = { file: string; name: string };
export type AcceptanceScenario = {
  id: string;
  given: string;
  when: string;
  then: string[];
  tests?: TestReference[];
};
export type Requirement = {
  id: string;
  category: string;
  rule: string;
  topic?: string;
  applies_to?: string[];
  acceptance?: AcceptanceScenario[];
};
export type FeatureSpecification = {
  kind: "feature";
  id: string;
  name: string;
  areas: string[];
  requirements: Requirement[];
  policy_refs?: string[];
  capabilities: Record<string, unknown>;
};
export type SpecificationFile = {
  path: string;
  data: Record<string, unknown>;
};

export async function readFeatureSpecifications<T = FeatureSpecification>(
  root = repositoryRoot,
): Promise<T[]> {
  const files = await readdir(join(root, "docs/features"));
  return Promise.all(
    files
      .filter((file) => file.endsWith(".yaml"))
      .sort()
      .map((file) => readSpecification<T>(`docs/features/${file}`, root)),
  );
}

/** Discover sources, rather than maintaining a second handwritten inventory. */
export async function readSpecifications(
  root = repositoryRoot,
): Promise<SpecificationFile[]> {
  const files: string[] = [];
  async function walk(directory: string) {
    for (const entry of await readdir(join(root, directory), {
      withFileTypes: true,
    })) {
      const path = `${directory}/${entry.name}`;
      if (entry.isDirectory()) await walk(path);
      else if (
        entry.name.endsWith(".json") &&
        !(directory === "docs/schemas" && entry.name.endsWith(".schema.json"))
      ) {
        throw new Error(
          `${path}: handwritten specifications must use YAML; JSON is reserved for schemas`,
        );
      } else if (entry.name.endsWith(".yaml") || entry.name.endsWith(".yml")) {
        if (!entry.name.endsWith(".yaml"))
          throw new Error(`${path}: use the .yaml extension`);
        files.push(path);
      }
    }
  }
  await walk("docs");
  return Promise.all(
    files.sort().map(async (path) => ({
      path,
      data: await readSpecification<Record<string, unknown>>(path, root),
    })),
  );
}
