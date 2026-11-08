import { DriverAdapterError } from "@prisma/driver-adapter-utils";
import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  isSerializationError,
  runSerializableTransaction,
} from "@/lib/db/serializable-transaction";

vi.mock("@/lib/db/prisma", () => ({ prisma: { $transaction: vi.fn() } }));

function wrappedConflict(originalCode = "40001") {
  return new Prisma.PrismaClientKnownRequestError("Private raw query details", {
    code: "P2010",
    clientVersion: "7.10.1",
    meta: {
      driverAdapterError: new DriverAdapterError({
        kind: "TransactionWriteConflict",
        originalCode,
        originalMessage: "Private database conflict details",
      }),
    },
  });
}

describe("serialization conflict classification", () => {
  it.each(["40001", "40P01"])(
    "recognizes the real P2010 adapter envelope for %s",
    (code) => {
      expect(isSerializationError(wrappedConflict(code))).toBe(true);
      expect(
        isSerializationError(
          new Error("outer", { cause: wrappedConflict(code) }),
        ),
      ).toBe(true);
    },
  );

  it("preserves P2034 and direct structured driver conflicts", () => {
    expect(
      isSerializationError(
        new Prisma.PrismaClientKnownRequestError("Conflict", {
          code: "P2034",
          clientVersion: "7.10.1",
        }),
      ),
    ).toBe(true);
    expect(
      isSerializationError(
        new DriverAdapterError({ kind: "TransactionWriteConflict" }),
      ),
    ).toBe(true);
  });

  it("does not infer retryability from P2010, message text or unrelated codes", () => {
    for (const error of [
      wrappedConflict("23505"),
      { code: "P2010" },
      { code: "40001" },
      { name: "DriverAdapterError", message: "TransactionWriteConflict" },
      {
        code: "P2010",
        meta: {
          driverAdapterError: {
            name: "DriverAdapterError",
            cause: { kind: "UniqueConstraintViolation", originalCode: "40001" },
          },
        },
      },
      {
        code: "P2010",
        meta: {
          driverAdapterError: {
            name: "OtherError",
            cause: { kind: "TransactionWriteConflict", originalCode: "40001" },
          },
        },
      },
      {
        code: "P2002",
        meta: {
          driverAdapterError: new DriverAdapterError({
            kind: "TransactionWriteConflict",
            originalCode: "40001",
          }),
        },
      },
      null,
      undefined,
      "TransactionWriteConflict",
      40001,
    ])
      expect(isSerializationError(error)).toBe(false);
  });

  it("ignores inherited fields and accessors without invoking them", () => {
    const getter = vi.fn(() => ({
      kind: "TransactionWriteConflict",
      originalCode: "40001",
    }));
    const driver = { name: "DriverAdapterError" };
    Object.defineProperty(driver, "cause", { get: getter });
    const metaGetter = vi.fn(() => ({ driverAdapterError: driver }));
    const error = { code: "P2010" };
    Object.defineProperty(error, "meta", { get: metaGetter });
    expect(isSerializationError(driver)).toBe(false);
    expect(isSerializationError(error)).toBe(false);
    expect(isSerializationError(Object.create({ code: "P2034" }))).toBe(false);
    expect(getter).not.toHaveBeenCalled();
    expect(metaGetter).not.toHaveBeenCalled();
  });

  it("terminates on cycles, excessive nesting and rejected descriptor reads", () => {
    const first: { cause?: unknown } = {};
    const second = { cause: first };
    first.cause = second;
    expect(isSerializationError(first)).toBe(false);
    let deep: unknown = wrappedConflict();
    for (let index = 0; index < 64; index += 1) deep = { cause: deep };
    expect(isSerializationError(deep)).toBe(false);
    expect(
      isSerializationError(
        new Proxy(
          {},
          {
            getOwnPropertyDescriptor() {
              throw new Error("unreadable");
            },
          },
        ),
      ),
    ).toBe(false);
  });
});

describe("bounded serializable retries", () => {
  it("retries the captured wrapped conflict and succeeds on the third existing attempt", async () => {
    const action = vi.fn(async () => "saved");
    const transaction = vi
      .mocked(prisma.$transaction)
      .mockReset()
      .mockRejectedValueOnce(wrappedConflict())
      .mockRejectedValueOnce(wrappedConflict())
      .mockResolvedValueOnce("saved");
    await expect(
      runSerializableTransaction(action, "not reached", prisma),
    ).resolves.toBe("saved");
    expect(transaction).toHaveBeenCalledTimes(3);
    for (let attempt = 1; attempt <= 3; attempt += 1)
      expect(transaction).toHaveBeenNthCalledWith(attempt, action, {
        isolationLevel: "Serializable",
      });
  });

  it("exhausts exactly three attempts and preserves the terminal error object", async () => {
    const error = wrappedConflict();
    const transaction = vi
      .mocked(prisma.$transaction)
      .mockReset()
      .mockRejectedValue(error);
    await expect(
      runSerializableTransaction(
        async () => "unreachable",
        "not substituted",
        prisma,
      ),
    ).rejects.toBe(error);
    expect(transaction).toHaveBeenCalledTimes(3);
  });

  it("does not retry an unrelated raw-query failure", async () => {
    const error = wrappedConflict("23505");
    const transaction = vi
      .mocked(prisma.$transaction)
      .mockReset()
      .mockRejectedValue(error);
    await expect(
      runSerializableTransaction(
        async () => "unreachable",
        "not substituted",
        prisma,
      ),
    ).rejects.toBe(error);
    expect(transaction).toHaveBeenCalledTimes(1);
  });
});
