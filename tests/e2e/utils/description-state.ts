import type { APIRequestContext } from "@playwright/test";
import { withE2ePrisma } from "./e2e-db/prisma";

export type DescriptionAuditAction =
  | "admin_description_moderate"
  | "description_edit";

export type DescriptionSnapshot = {
  auditActions: DescriptionAuditAction[];
  auditIds: string[];
  content: string;
  editIds: string[];
  id: string;
  lastEditedAt: Date | null;
  lastEditedById: string | null;
  updatedAt: Date;
};

type DescriptionTargetReference = {
  courseJwId?: number | string;
  homeworkId?: number | string;
  sectionJwId?: number | string;
  targetId?: number | string;
  targetType: "course" | "homework" | "section" | "teacher";
  teacherId?: number | string;
};

type DescriptionTargetSnapshot = {
  auditActions: DescriptionAuditAction[];
  original: DescriptionSnapshot | null;
  target: DescriptionTargetReference;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function newAuditWhere(snapshot: DescriptionSnapshot) {
  const where = {
    action: { in: snapshot.auditActions },
    targetId: snapshot.id,
    targetType: "description",
  };
  return snapshot.auditIds.length > 0
    ? { ...where, id: { notIn: snapshot.auditIds } }
    : where;
}

function newEditWhere(snapshot: DescriptionSnapshot) {
  const where = {
    descriptionId: snapshot.id,
  };
  return snapshot.editIds.length > 0
    ? { ...where, id: { notIn: snapshot.editIds } }
    : where;
}

export async function snapshotDescriptionForE2e(
  id: string,
  auditActions: DescriptionAuditAction[],
) {
  return withE2ePrisma(async (prisma) => {
    const description = await prisma.description.findUnique({
      where: { id },
      select: {
        content: true,
        id: true,
        lastEditedAt: true,
        lastEditedById: true,
        updatedAt: true,
      },
    });
    if (!description) {
      throw new Error(`Expected description ${id} to exist`);
    }

    const [edits, audits] = await Promise.all([
      prisma.descriptionEdit.findMany({
        where: { descriptionId: id },
        select: { id: true },
      }),
      prisma.auditLog.findMany({
        where: {
          action: { in: auditActions },
          targetId: id,
          targetType: "description",
        },
        select: { id: true },
      }),
    ]);

    return {
      ...description,
      auditActions,
      auditIds: audits.map((audit) => audit.id),
      editIds: edits.map((edit) => edit.id),
    };
  });
}

function descriptionTargetSearchParams(target: DescriptionTargetReference) {
  const params = new URLSearchParams({ targetType: target.targetType });
  for (const [key, value] of Object.entries(target)) {
    if (key === "targetType" || value === undefined) continue;
    params.set(key, String(value));
  }
  return params;
}

async function findDescriptionIdForTarget(
  request: APIRequestContext,
  target: DescriptionTargetReference,
) {
  const response = await request.get(
    `/api/community/descriptions?${descriptionTargetSearchParams(target).toString()}`,
  );
  if (response.status() !== 200) {
    throw new Error(
      `Expected description lookup to return 200, got ${response.status()}`,
    );
  }
  const body = (await response.json()) as {
    description?: { id?: string | null } | null;
  };
  return body.description?.id ?? null;
}

export async function snapshotDescriptionTargetForE2e(
  request: APIRequestContext,
  target: DescriptionTargetReference,
  auditActions: DescriptionAuditAction[],
): Promise<DescriptionTargetSnapshot> {
  const descriptionId = await findDescriptionIdForTarget(request, target);
  return {
    auditActions,
    original: descriptionId
      ? await snapshotDescriptionForE2e(descriptionId, auditActions)
      : null,
    target,
  };
}

export async function waitForDescriptionAuditRows(
  snapshot: DescriptionSnapshot,
  expectedNewRows: number,
) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const count = await withE2ePrisma((prisma) =>
      prisma.auditLog.count({ where: newAuditWhere(snapshot) }),
    );
    if (count >= expectedNewRows) return;
    await sleep(25);
  }
}

export async function restoreDescriptionSnapshot(
  snapshot: DescriptionSnapshot,
) {
  async function restoreOnce() {
    await withE2ePrisma(async (prisma) => {
      await prisma.$transaction([
        prisma.auditLog.deleteMany({ where: newAuditWhere(snapshot) }),
        prisma.descriptionEdit.deleteMany({ where: newEditWhere(snapshot) }),
        prisma.description.update({
          where: { id: snapshot.id },
          data: {
            content: snapshot.content,
            lastEditedAt: snapshot.lastEditedAt,
            lastEditedById: snapshot.lastEditedById,
            updatedAt: snapshot.updatedAt,
          },
        }),
      ]);
    });
  }

  await restoreOnce();
  await sleep(50);
  await restoreOnce();
}

export async function restoreDescriptionTargetSnapshot(
  request: APIRequestContext,
  snapshot: DescriptionTargetSnapshot,
) {
  if (snapshot.original) {
    await restoreDescriptionSnapshot(snapshot.original);
    return;
  }

  const descriptionId = await findDescriptionIdForTarget(
    request,
    snapshot.target,
  );
  if (!descriptionId) return;
  const createdDescriptionId = descriptionId;

  async function deleteCreatedDescriptionOnce() {
    await withE2ePrisma(async (prisma) => {
      await prisma.$transaction([
        prisma.auditLog.deleteMany({
          where: {
            action: { in: snapshot.auditActions },
            targetId: createdDescriptionId,
            targetType: "description",
          },
        }),
        prisma.descriptionEdit.deleteMany({
          where: { descriptionId: createdDescriptionId },
        }),
        prisma.description.deleteMany({ where: { id: createdDescriptionId } }),
      ]);
    });
  }

  await deleteCreatedDescriptionOnce();
  await sleep(50);
  await deleteCreatedDescriptionOnce();
}
