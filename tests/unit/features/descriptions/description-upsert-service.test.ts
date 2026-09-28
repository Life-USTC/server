import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  runWithCloudflareRuntimeEnv,
  setCloudflareCatalogInvalidator,
} from "@/lib/adapters/cloudflare-runtime";
import { bindDomainOperation } from "../../../shared/specifications/domain-contracts";
import { semanticContract } from "../../../shared/specifications/semantic-contract";

const {
  calendarRebuildMock,
  auditLogCreateMock,
  descriptionCreateMock,
  descriptionEditCreateMock,
  descriptionFindFirstMock,
  descriptionUpdateMock,
  getViewerContextMock,
  isPrismaUniqueConstraintErrorMock,
  prismaMock,
  sectionFindUniqueMock,
} = vi.hoisted(() => ({
  calendarRebuildMock: vi.fn(),
  auditLogCreateMock: vi.fn(),
  descriptionCreateMock: vi.fn(),
  descriptionEditCreateMock: vi.fn(),
  descriptionFindFirstMock: vi.fn(),
  descriptionUpdateMock: vi.fn(),
  getViewerContextMock: vi.fn(),
  isPrismaUniqueConstraintErrorMock: vi.fn(),
  prismaMock: {
    $transaction: vi.fn(),
    auditLog: {
      createMany: vi.fn(),
    },
    description: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    descriptionEdit: {
      create: vi.fn(),
    },
    homework: { findUnique: vi.fn() },
    section: {
      findUnique: vi.fn(),
    },
  },
  sectionFindUniqueMock: vi.fn(),
}));

vi.mock("@/features/calendar/server/calendar-export-invalidation", () => ({
  scheduleInvalidateCalendarExportsForSection: calendarRebuildMock,
}));

vi.mock("@/lib/auth/viewer-context", () => ({
  getViewerContext: getViewerContextMock,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/db/prisma-errors", () => ({
  isPrismaUniqueConstraintError: isPrismaUniqueConstraintErrorMock,
}));

describe("upsertDescriptionContent", () => {
  beforeEach(() => {
    calendarRebuildMock.mockReset();
    prismaMock.homework.findUnique.mockReset();
    prismaMock.homework.findUnique.mockResolvedValue({
      id: "homework-1",
      sectionId: 1,
    });
    auditLogCreateMock.mockReset();
    descriptionCreateMock.mockReset();
    descriptionEditCreateMock.mockReset();
    descriptionFindFirstMock.mockReset();
    descriptionUpdateMock.mockReset();
    getViewerContextMock.mockReset();
    isPrismaUniqueConstraintErrorMock.mockReset();
    sectionFindUniqueMock.mockReset();

    prismaMock.auditLog.createMany = auditLogCreateMock;
    prismaMock.description.create = descriptionCreateMock;
    prismaMock.description.findFirst = descriptionFindFirstMock;
    prismaMock.description.update = descriptionUpdateMock;
    prismaMock.descriptionEdit.create = descriptionEditCreateMock;
    prismaMock.section.findUnique = sectionFindUniqueMock;
    prismaMock.$transaction.mockReset();
    prismaMock.$transaction.mockImplementation(async (action) =>
      action({
        auditLog: prismaMock.auditLog,
        description: prismaMock.description,
        descriptionEdit: prismaMock.descriptionEdit,
      }),
    );

    auditLogCreateMock.mockResolvedValue({});
    descriptionEditCreateMock.mockResolvedValue({});
    getViewerContextMock.mockResolvedValue({
      isAuthenticated: true,
      isSuspended: false,
    });
    isPrismaUniqueConstraintErrorMock.mockReturnValue(false);
    sectionFindUniqueMock.mockResolvedValue({ id: 1 });
  });

  it("当必需的审计写入失败时拒绝变更内容", async () => {
    const auditError = new Error("audit unavailable");
    descriptionFindFirstMock.mockResolvedValue({
      id: "description-1",
      content: "old content",
    });
    descriptionUpdateMock.mockResolvedValue({
      id: "description-1",
      content: "new content",
    });
    auditLogCreateMock.mockRejectedValueOnce(auditError);
    const { upsertDescriptionContent } = await import(
      "@/features/descriptions/server/description-upsert"
    );

    await expect(
      upsertDescriptionContent({
        auditMetadata: {
          ipAddress: "192.0.2.40",
          source: "graphql",
          userAgent: "graphql-unit-agent",
        },
        content: "new content",
        targetId: 1,
        targetType: "section",
        userId: "user-1",
      }),
    ).rejects.toThrow(auditError);

    expect(descriptionEditCreateMock).toHaveBeenCalledWith({
      data: {
        descriptionId: "description-1",
        editorId: "user-1",
        previousContent: "old content",
        nextContent: "new content",
      },
    });
    expect(auditLogCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "description_edit",
        metadata: {
          targetType: "section",
          changedFields: ["content"],
          source: "graphql",
        },
        targetId: "description-1",
        targetType: "description",
        userId: "user-1",
        ipAddress: "192.0.2.40",
        userAgent: "graphql-unit-agent",
      }),
    });
  });

  it("description.unchanged-write-history", async (context) => {
    const contract = await semanticContract(
      "description.unchanged-write-history",
      "unchanged_write",
    );
    descriptionFindFirstMock.mockResolvedValue({
      id: "description-1",
      content: "same content",
    });
    const { upsertDescriptionContent } = await import(
      "@/features/descriptions/server/description-upsert"
    );

    const write = bindDomainOperation(
      contract,
      "src/features/descriptions/server/description-upsert.ts",
      upsertDescriptionContent,
    );
    const result = await write({
      content: "same content",
      targetId: 1,
      targetType: "section",
      userId: "user-1",
    });

    contract.equal("/updated", result.ok ? result.updated : null);
    contract.equal(
      "/history_created",
      descriptionEditCreateMock.mock.calls.length,
    );
    contract.equal("/audits_created", auditLogCreateMock.mock.calls.length);
    contract.recordVitest(context);
    expect(result).toEqual({
      id: "description-1",
      ok: true,
      updated: false,
    });
    expect(descriptionEditCreateMock).not.toHaveBeenCalled();
    expect(auditLogCreateMock).not.toHaveBeenCalled();
  });
  it("purges only after commit and retries a failed purge on an unchanged write", async () => {
    descriptionFindFirstMock.mockResolvedValue({
      id: "description-1",
      content: "before",
    });
    descriptionUpdateMock.mockResolvedValue({
      id: "description-1",
      content: "after",
    });
    const { upsertDescriptionContent } = await import(
      "@/features/descriptions/server/description-upsert"
    );
    let committed = false;
    let cachedHtml: string | null = "before";
    const transaction = prismaMock.$transaction.getMockImplementation();
    prismaMock.$transaction.mockImplementation(async (...args) => {
      const result = await transaction?.(...args);
      committed = true;
      return result;
    });
    const purge = vi
      .fn(async () => {
        expect(committed).toBe(true);
        cachedHtml = null;
      })
      .mockRejectedValueOnce(new Error("purge unavailable"));
    const write = () =>
      runWithCloudflareRuntimeEnv({}, async () => {
        setCloudflareCatalogInvalidator(purge);
        return upsertDescriptionContent({
          content: "after",
          targetId: 1,
          targetType: "section",
          userId: "user-1",
        });
      });
    await expect(write()).rejects.toThrow("purge unavailable");
    expect(cachedHtml).toBe("before");
    descriptionFindFirstMock.mockResolvedValue({
      id: "description-1",
      content: "after",
    });
    await expect(write()).resolves.toMatchObject({ ok: true, updated: false });
    expect(cachedHtml).toBeNull();
    expect(purge).toHaveBeenCalledTimes(2);
    expect(descriptionEditCreateMock).toHaveBeenCalledOnce();
  });

  it("description.failed-write-invalidation", async (context) => {
    const contract = await semanticContract(
      "description.failed-write-invalidation",
      "transaction_effects",
    );
    prismaMock.$transaction.mockRejectedValue(new Error("rollback"));
    const purge = vi.fn();
    const { upsertDescriptionContent } = await import(
      "@/features/descriptions/server/description-upsert"
    );
    const write = bindDomainOperation(
      contract,
      "src/features/descriptions/server/description-upsert.ts",
      upsertDescriptionContent,
    );
    const effects = [
      {
        module: "src/lib/adapters/cloudflare-runtime.ts",
        export: "invalidateCloudflareCatalogRepresentations",
        observe: () => purge.mock.calls.length,
      },
      {
        module: "src/features/calendar/server/calendar-export-invalidation.ts",
        export: "scheduleInvalidateCalendarExportsForSection",
        observe: () => calendarRebuildMock.mock.calls.length,
      },
    ];
    const observe = (phase: string) =>
      effects.forEach(({ module, export: exported, observe }, index) => {
        contract.equal(`/${phase}/${index}/operation`, {
          module,
          export: exported,
        });
        contract.equal(`/${phase}/${index}/calls`, observe());
      });
    observe("before_commit");
    await runWithCloudflareRuntimeEnv({}, async () => {
      setCloudflareCatalogInvalidator(purge);
      for (const target of [
        { targetId: 1, targetType: "section" as const },
        { targetId: "homework-1", targetType: "homework" as const },
      ]) {
        const pending = write({
          content: "after",
          ...target,
          userId: "user-1",
        });
        const outcome = pending.then(
          () => ({ completion: "commit", failed: false }),
          () => ({ completion: "rollback", failed: true }),
        );
        await expect(pending).rejects.toThrow("rollback");
        const result = await outcome;
        contract.equal("/completion", result.completion);
        contract.equal("/failure_propagated", result.failed);
      }
    });
    observe("after_completion");
    contract.recordVitest(context);
    expect(purge).not.toHaveBeenCalled();
    expect(calendarRebuildMock).not.toHaveBeenCalled();
  });
});
