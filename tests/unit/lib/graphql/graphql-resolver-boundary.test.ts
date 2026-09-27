import { fileURLToPath } from "node:url";
import { Project, SyntaxKind } from "ts-morph";
import { expect, it } from "vitest";

it("graphql.resolver-boundary", () => {
  const project = new Project({ skipAddingFilesFromTsConfig: true });
  const directory = fileURLToPath(
    new URL("../../../../src/lib/graphql/", import.meta.url),
  );
  project.addSourceFilesAtPaths(`${directory}/**/*.ts`);
  const violations: string[] = [];
  const files = project.getSourceFiles();
  expect(files.some((file) => file.getBaseName() === "schema.ts")).toBe(true);
  expect(
    files.some((file) => file.getFilePath().endsWith("/mutations/index.ts")),
  ).toBe(true);
  for (const file of files) {
    const path = file.getFilePath().slice(directory.length);
    for (const declaration of file.getImportDeclarations()) {
      const module = declaration.getModuleSpecifierValue();
      if (
        /^@\/lib\/(?:db|api\/routes)\//.test(module) ||
        /^(?:node:)?https?$|^(?:axios|ky|undici|pg|postgres)$/.test(module)
      )
        violations.push(`${path}: ${module}`);
      if (
        declaration
          .getNamedImports()
          .some((name) => name.getName() === "PrismaClient")
      )
        violations.push(`${path}: PrismaClient`);
    }
    for (const call of file.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      const expression = call.getExpression().getText();
      if (
        /^(?:globalThis\.|window\.)?fetch$/.test(expression) ||
        /\.(?:\$queryRaw\w*|\$executeRaw\w*|\$transaction)$/.test(expression)
      )
        violations.push(`${path}: ${expression}`);
      if (
        expression.endsWith(".fetch") &&
        !(
          (path === "server.ts" && expression === "yoga.fetch") ||
          (path === "document-runner.ts" &&
            expression === "mcpGraphqlYoga.fetch")
        )
      )
        violations.push(`${path}: network-like ${expression}`);
    }
  }
  expect(violations).toEqual([]);
});
