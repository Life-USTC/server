import { readFile, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isAlias, isMap, isScalar, parseAllDocuments, visit } from "yaml";

export const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));

/** One YAML 1.2 mapping containing only JSON-compatible values. */
export function parseSpecificationYaml(text: string, source: string): unknown {
  const fail = (message: string): never => {
    throw new Error(`${source}: ${message}`);
  };
  const documents = parseAllDocuments(text, {
    version: "1.2",
    schema: "core",
    strict: true,
    uniqueKeys: true,
    merge: false,
    resolveKnownTags: false,
  });
  if (documents.length !== 1) fail("expected exactly one YAML document");
  const document = documents[0];
  const diagnostics = [...document.errors, ...document.warnings];
  if (diagnostics.length)
    fail(diagnostics.map((item) => item.message).join("\n"));
  if (document.directives?.yaml.version !== "1.2") {
    fail("only YAML 1.2 is permitted");
  }
  const tags = document.directives?.tags ?? {};
  if (
    Object.entries(tags).some(
      ([key, value]) => key !== "!!" || value !== "tag:yaml.org,2002:",
    )
  ) {
    fail("tag directives are not permitted");
  }
  if (!isMap(document.contents)) fail("the document root must be a mapping");
  visit(document, {
    Node(_key, node) {
      if (isAlias(node)) fail("aliases are not permitted");
      if ("anchor" in node && node.anchor) fail("anchors are not permitted");
      if ("tag" in node && node.tag) fail("explicit tags are not permitted");
      if (isMap(node)) {
        for (const pair of node.items) {
          if (!isScalar(pair.key) || typeof pair.key.value !== "string") {
            fail("mapping keys must be strings");
          }
          if (isScalar(pair.key) && pair.key.value === "<<")
            fail("merge keys are not permitted");
        }
      }
      if (isScalar(node) && typeof node.value === "number") {
        if (!Number.isFinite(node.value)) fail("numbers must be finite");
        if (Number.isInteger(node.value) && !Number.isSafeInteger(node.value)) {
          fail("integers must be within JavaScript's exact integer range");
        }
      }
    },
  });
  return document.toJS({ maxAliasCount: 0 });
}

export async function resolveRepositoryFile(
  root: string,
  path: string,
): Promise<string> {
  if (isAbsolute(path))
    throw new Error(`Expected a repository-relative path: ${path}`);
  const actualRoot = await realpath(root);
  const actualPath = await realpath(resolve(actualRoot, path));
  const within = relative(actualRoot, actualPath);
  if (within === ".." || within.startsWith("../") || isAbsolute(within)) {
    throw new Error(`Path escapes the repository: ${path}`);
  }
  return actualPath;
}

export async function readSpecification<T = unknown>(
  path: string,
  root = repositoryRoot,
): Promise<T> {
  const filename = await resolveRepositoryFile(root, path);
  return parseSpecificationYaml(await readFile(filename, "utf8"), path) as T;
}
