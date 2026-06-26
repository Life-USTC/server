import { describe, expect, it } from "vitest";
import {
  getExportedRouteMethods,
  getRouteExport,
  getRouteExportKind,
  HTTP_METHODS,
} from "../../tools/shared/route-exports";

describe("route export parser", () => {
  it("keeps route parity checks aware of preflight and head methods", () => {
    expect(HTTP_METHODS).toEqual([
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "HEAD",
      "OPTIONS",
    ]);
  });

  it("detects function, const, and destructured route exports", () => {
    const source = `
      export async function GET() {}
      export const POST = handler;
      export const { HEAD, OPTIONS }: Handlers = handlers;
    `;

    expect(getRouteExportKind(source, "GET")).toBe("function");
    expect(getRouteExportKind(source, "POST")).toBe("const");
    expect(getRouteExportKind(source, "OPTIONS")).toBe("destructured");
    expect(getRouteExport(source, "OPTIONS")?.initializer?.getText()).toBe(
      "handlers",
    );
    expect(getExportedRouteMethods(source)).toEqual([
      "GET",
      "POST",
      "HEAD",
      "OPTIONS",
    ]);
  });

  it("ignores comments, aliases, and non-const bindings", () => {
    const source = `
      // export function GET() {}
      const text = "export const POST = handler";
      export let PATCH = handler;
      export const { DELETE: deleteHandler } = handlers;
    `;

    expect(getExportedRouteMethods(source)).toEqual([]);
  });

  it("returns the AST node that owns route export JSDoc", () => {
    const source = `
      /**
       * List things.
       * @response thingsResponseSchema
       */
      export const GET = svelteRequestHandler(observedApiRoute(getThings));
    `;

    const routeExport = getRouteExport(source, "GET");

    expect(routeExport?.kind).toBe("const");
    expect(routeExport?.node.getText(routeExport.sourceFile)).toContain(
      "export const GET",
    );
    expect(routeExport?.initializer?.getText(routeExport.sourceFile)).toBe(
      "svelteRequestHandler(observedApiRoute(getThings))",
    );
  });
});
