import { describe, expect, it } from "vitest";
import {
  getExportedRouteMethods,
  getRouteExportKind,
} from "../../tools/shared/route-exports";

describe("route export parser", () => {
  it("detects function, const, and destructured route exports", () => {
    const source = `
      export async function GET() {}
      export const POST = handler;
      export const { HEAD, OPTIONS }: Handlers = handlers;
    `;

    expect(getRouteExportKind(source, "GET")).toBe("function");
    expect(getRouteExportKind(source, "POST")).toBe("const");
    expect(getRouteExportKind(source, "OPTIONS")).toBe("destructured");
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
});
