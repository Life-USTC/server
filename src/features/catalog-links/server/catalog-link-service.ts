import { USTC_CATALOG_LINKS } from "@/features/catalog-links/lib/catalog-links";
import { withUserDbContext } from "@/lib/db/prisma";
import { logAppEvent } from "@/lib/log/app-logger";

export const MAX_PINNED_LINKS = 4;

type WorkspaceLinkPinRow = { slug: string };

type WorkspaceLinkPinDelegate = {
  deleteMany: (input: {
    where: { userId: string; slug?: string | { in: string[] } };
  }) => Promise<unknown>;
  findMany: (input: {
    where: { userId: string };
    select: { slug: true };
    orderBy?: { createdAt: "asc" };
  }) => Promise<WorkspaceLinkPinRow[]>;
  upsert: (input: {
    where: { userId_slug: { userId: string; slug: string } };
    create: { userId: string; slug: string };
    update: Record<string, never>;
  }) => Promise<unknown>;
};

type WorkspaceLinkPinPrisma = {
  workspaceLinkPin: WorkspaceLinkPinDelegate;
};

function normalizeUserId(userId: string) {
  const normalized = userId.trim();
  if (!normalized) throw new Error("Catalog link user ID is required");
  return normalized;
}

export function resolveCatalogLinkBySlug(slug: string | null | undefined) {
  const normalizedSlug = slug?.trim();
  if (!normalizedSlug) return null;
  return (
    USTC_CATALOG_LINKS.find((link) => link.slug === normalizedSlug) ?? null
  );
}

export function sanitizeWorkspaceReturnTo(value: string | undefined): string {
  if (!value?.startsWith("/")) return "/";
  if (value.startsWith("//")) return "/";
  if (/[\\\r\n]/.test(value)) return "/";
  return value;
}

export async function recordCatalogLinkClick(userId: string, slug: string) {
  userId = normalizeUserId(userId);
  try {
    await withUserDbContext(userId, (tx) =>
      tx.catalogLinkClick.upsert({
        where: {
          userId_slug: {
            userId,
            slug,
          },
        },
        create: {
          userId,
          slug,
          count: 1,
          lastClickedAt: new Date(),
        },
        update: {
          count: { increment: 1 },
          lastClickedAt: new Date(),
        },
      }),
    );
  } catch (error) {
    logAppEvent(
      "warn",
      "Failed to record catalog link click",
      {
        source: "catalog-links",
        slug,
      },
      error,
    );
  }
}

export async function updateWorkspaceLinkPinState({
  action,
  slug,
  userId,
}: {
  action: "pin" | "unpin";
  slug: string;
  userId: string;
}) {
  userId = normalizeUserId(userId);
  return withUserDbContext(userId, (tx) => {
    if (action === "pin") {
      return pinWorkspaceLink(tx, userId, slug);
    }

    return unpinWorkspaceLink(tx, userId, slug);
  });
}

export async function getWorkspaceLinkPinnedSlugs(userId: string) {
  userId = normalizeUserId(userId);
  return withUserDbContext(userId, (tx) => listWorkspaceLinkPins(tx, userId));
}

export function logWorkspaceLinkPinFailure({
  action,
  error,
  slug,
}: {
  action: "pin" | "unpin";
  error: unknown;
  slug: string;
}) {
  logAppEvent(
    "error",
    "Failed to update workspace link pin state",
    {
      source: "catalog-links",
      slug,
      action,
    },
    error,
  );
}

async function pinWorkspaceLink(
  prisma: WorkspaceLinkPinPrisma,
  userId: string,
  slug: string,
) {
  await prisma.workspaceLinkPin.upsert({
    where: { userId_slug: { userId, slug } },
    create: { userId, slug },
    update: {},
  });

  const pinnedRows = await prisma.workspaceLinkPin.findMany({
    where: { userId },
    select: { slug: true },
    orderBy: { createdAt: "asc" },
  });
  const overflowRows = pinnedRows.slice(0, -MAX_PINNED_LINKS);

  if (overflowRows.length > 0) {
    await prisma.workspaceLinkPin.deleteMany({
      where: {
        userId,
        slug: { in: overflowRows.map((row) => row.slug) },
      },
    });
  }

  return listWorkspaceLinkPins(prisma, userId);
}

async function unpinWorkspaceLink(
  prisma: WorkspaceLinkPinPrisma,
  userId: string,
  slug: string,
) {
  await prisma.workspaceLinkPin.deleteMany({
    where: { userId, slug },
  });

  return listWorkspaceLinkPins(prisma, userId);
}

async function listWorkspaceLinkPins(
  prisma: WorkspaceLinkPinPrisma,
  userId: string,
) {
  const finalRows = await prisma.workspaceLinkPin.findMany({
    where: { userId },
    select: { slug: true },
  });
  return finalRows.map((row) => row.slug);
}
