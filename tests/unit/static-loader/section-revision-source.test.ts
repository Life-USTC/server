import { expect, it, vi } from "vitest";
import type { Prisma } from "@/generated/prisma-node/client";
import { previousSectionRevisionTracked } from "@/static-loader/import-groups";

it("only preserves a section generation across imports with a matching source", async () => {
  const global = { id: "global", snapshotSha256: "a", transformRevision: 9 };
  const source = { ...global, id: "section-page-core-source" };
  const findMany = vi.fn();
  const tx = {
    staticImportState: { findMany },
  } as unknown as Prisma.TransactionClient;
  for (const [rows, tracked] of [
    [[], false],
    [[global], false],
    [[source, global], true],
    [[source, { ...global, snapshotSha256: "b" }], false],
    [[source, { ...global, transformRevision: 10 }], false],
  ] as const) {
    findMany.mockResolvedValueOnce(rows);
    await expect(previousSectionRevisionTracked(tx)).resolves.toBe(tracked);
  }
});
