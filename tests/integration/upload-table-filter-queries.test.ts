import { expect } from "vitest";
import { listUploads } from "@/features/uploads/server/upload-list";
import { adminGovernanceTest as it } from "../shared/admin-governance-fixture";

it("upload.table-column-filters-preserve-owner-count-pages-and-usage", {
  tags: ["@Upload/Service"],
}, async ({ governance }) => {
  const { db, userId, secondUserId, run } = governance;
  const matching = Array.from({ length: 25 }, (_, index) => ({
    id: `matching-upload-${index}`,
    userId,
    key: `uploads/${userId}/matching-${index}.txt`,
    filename: `report-${index}.txt`,
    size: 128,
    createdAt: new Date(`2026-10-23T16:00:${String(index).padStart(2, "0")}Z`),
  }));
  await db.upload.createMany({
    data: [
      ...matching,
      {
        userId,
        key: `uploads/${userId}/wrong-size.txt`,
        filename: "report-large.txt",
        size: 1024,
        createdAt: new Date("2026-10-24T00:00:00Z"),
      },
      {
        userId,
        key: `uploads/${userId}/wrong-date.txt`,
        filename: "report-later.txt",
        size: 128,
        createdAt: new Date("2026-10-24T16:00:00Z"),
      },
      {
        userId: secondUserId,
        key: `uploads/${secondUserId}/other.txt`,
        filename: "report-private.txt",
        size: 128,
        createdAt: new Date("2026-10-24T00:00:00Z"),
      },
    ],
  });
  await db.uploadPending.create({
    data: {
      userId,
      attemptId: "pending-attempt",
      key: `uploads/${userId}/pending.txt`,
      filename: "pending.txt",
      size: 10,
      expiresAt: new Date("2099-01-01T00:00:00Z"),
    },
  });
  const ids: string[] = [];
  for (const skip of [0, 20]) {
    const result = await run(() =>
      listUploads(
        userId,
        { pageSize: 20, skip },
        {
          filename: "report",
          size: "100",
          sizeOp: "between",
          sizeMax: "200",
          createdAt: "2026-10-24",
        },
      ),
    );
    expect(result.total).toBe(25);
    expect(result.uploads).toHaveLength(skip === 0 ? 20 : 5);
    expect(result.usedBytes).toBe(25 * 128 + 1024 + 128 + 10);
    ids.push(...result.uploads.map((upload) => upload.id));
  }
  expect(new Set(ids)).toEqual(new Set(matching.map((upload) => upload.id)));
  const invalid = await run(() =>
    listUploads(userId, { pageSize: 20, skip: 0 }, { size: "Infinity" }),
  );
  expect(invalid.total).toBe(0);
  expect(invalid.uploads).toEqual([]);
});

it.for<{
  label: string;
  filters: Record<string, string>;
  matches?: boolean;
}>([
  { label: "fractional-size", filters: { size: "3.5" } },
  { label: "oversized-size", filters: { size: "1e100" } },
  { label: "int32-overflow", filters: { size: "2147483648" } },
  {
    label: "fractional-maximum",
    filters: { size: "0", sizeOp: "between", sizeMax: "128.5" },
  },
  {
    label: "oversized-maximum",
    filters: { size: "0", sizeOp: "between", sizeMax: "1e100" },
  },
  {
    label: "ignored-maximum",
    filters: { size: "128", sizeOp: "eq", sizeMax: "1e100" },
    matches: true,
  },
  {
    label: "absent-size",
    filters: { size: "", sizeOp: "between", sizeMax: "1e100" },
    matches: true,
  },
  {
    label: "valid-int32-maximum",
    filters: { size: "128", sizeOp: "between", sizeMax: "2147483647" },
    matches: true,
  },
])(
  "upload.table-column-filters-size-$label",
  {
    tags: ["@Upload/Service"],
  },
  async ({ filters, matches }, { governance }) => {
    const { db, userId, run } = governance;
    const upload = await db.upload.create({
      data: {
        userId,
        key: `uploads/${userId}/boundary.txt`,
        filename: "boundary.txt",
        size: 128,
      },
    });
    const result = await run(() =>
      listUploads(userId, { pageSize: 20, skip: 0 }, filters),
    );
    expect(result.total).toBe(matches ? 1 : 0);
    expect(result.uploads.map((row) => row.id)).toEqual(
      matches ? [upload.id] : [],
    );
    expect(result.usedBytes).toBe(128);
  },
);
