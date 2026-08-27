import { describe, expect, test } from "vitest";
import { prismaWasmModulePlugin } from "../../vite.config";

describe("Vite Prisma WASM module handling", () => {
  test("serves the query compiler as a WebAssembly.Module in development", async () => {
    const plugin = prismaWasmModulePlugin("serve");
    const importer = "/workspace/src/generated/prisma/internal/class.ts";
    const source = "./query_compiler_fast_bg.wasm?module";

    const resolved = await plugin.resolveId?.call(
      {} as never,
      source,
      importer,
      {} as never,
    );

    expect(resolved).toBe("\0life-ustc:prisma-wasm-module");
    const loaded = await plugin.load?.call({} as never, resolved as string);
    expect(loaded).toContain('import { readFileSync } from "node:fs"');
    expect(loaded).toContain("new WebAssembly.Module(readFileSync");
    expect(loaded).toContain(
      "/workspace/src/generated/prisma/internal/query_compiler_fast_bg.wasm",
    );
  });

  test("leaves production WASM imports external for the Worker build", async () => {
    const plugin = prismaWasmModulePlugin("build");

    expect(
      await plugin.resolveId?.call(
        {} as never,
        "./query_compiler_fast_bg.wasm?module",
        "/workspace/src/generated/prisma/internal/class.ts",
        {} as never,
      ),
    ).toEqual({
      id: "/workspace/src/generated/prisma/internal/query_compiler_fast_bg.wasm?module",
      external: true,
    });
  });
});
