import { readFileSync } from "node:fs";
import { join } from "node:path";
import { repoRoot, reportUnexpectedError } from "./common";

function checkI18nKeys() {
  type Locale = "en-us" | "zh-cn";
  type ShapeKind = "array" | "object" | "value";

  const messagesRoot = join(repoRoot, "messages");
  const locales: Locale[] = ["en-us", "zh-cn"];

  function readJson(filePath: string): unknown {
    return JSON.parse(readFileSync(filePath, "utf8")) as unknown;
  }

  function shapeKind(value: unknown): ShapeKind {
    if (Array.isArray(value)) return "array";
    if (value !== null && typeof value === "object") return "object";
    return "value";
  }

  function collectShape(
    value: unknown,
    pathParts: string[] = [],
    shape = new Map<string, ShapeKind>(),
  ) {
    const kind = shapeKind(value);
    if (pathParts.length > 0) {
      shape.set(pathParts.join("."), kind);
    }

    if (kind !== "object") return shape;

    for (const [key, child] of Object.entries(
      value as Record<string, unknown>,
    )) {
      collectShape(child, [...pathParts, key], shape);
    }

    return shape;
  }

  const shapes = new Map<Locale, Map<string, ShapeKind>>(
    locales.map((locale) => [
      locale,
      collectShape(readJson(join(messagesRoot, `${locale}.json`))),
    ]),
  );
  const referenceLocale = locales[0];
  const referenceShape = shapes.get(referenceLocale) ?? new Map();
  const allPaths = new Set<string>();

  for (const shape of shapes.values()) {
    for (const key of shape.keys()) allPaths.add(key);
  }

  const issues: string[] = [];
  for (const key of Array.from(allPaths).sort()) {
    const referenceKind = referenceShape.get(key);
    for (const locale of locales) {
      const kind = shapes.get(locale)?.get(key);
      if (!kind) {
        issues.push(`${locale} missing key: ${key}`);
        continue;
      }
      if (referenceKind && kind !== referenceKind) {
        issues.push(
          `${locale} has ${kind} at ${key}; ${referenceLocale} has ${referenceKind}`,
        );
      }
    }
  }

  if (issues.length > 0) {
    console.error("i18n locale shape check failed:\n");
    for (const issue of issues) console.error(`- ${issue}`);
    process.exit(1);
  }
}

try {
  checkI18nKeys();
} catch (error: unknown) {
  reportUnexpectedError(error);
}
