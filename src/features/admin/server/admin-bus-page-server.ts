import type { RequestEvent } from "@sveltejs/kit";
import {
  getAdminBusPage,
  requireAdminPage,
} from "@/features/admin/server/admin-page-data";
import { loadBusStaticPayload } from "@/features/bus/lib/bus-static-source";
import { importBusStaticPayload } from "@/features/bus/server/bus-import";
import type { AppLocale } from "@/i18n/config";
import { writeAuditLog } from "@/lib/audit/write-audit-log";
import { prisma } from "@/lib/db/prisma";
import { logServerActionError } from "@/lib/log/app-logger";
import enUsMessages from "../../../../messages/en-us.json";
import zhCnMessages from "../../../../messages/zh-cn.json";
import {
  adminBusFailure as failure,
  parseAdminBusVersionId,
  adminBusSuccess as success,
} from "./admin-bus-action-helpers";

const messages = {
  "zh-cn": zhCnMessages,
  "en-us": enUsMessages,
} satisfies Record<AppLocale, typeof enUsMessages>;

type AdminBusEvent = Pick<RequestEvent, "locals" | "request">;

function getCopy(locale: AppLocale) {
  const copy = messages[locale];
  return {
    admin: copy.admin,
    adminBus: copy.adminBus,
    common: copy.common,
  };
}

export const loadAdminBusPage = async ({ locals, request }: AdminBusEvent) => {
  return {
    ...(await getAdminBusPage(request)),
    locale: locals.locale,
    copy: getCopy(locals.locale),
  };
};

export const adminBusActions = {
  activateVersion: async ({ locals, request }: AdminBusEvent) => {
    const copy = getCopy(locals.locale).adminBus;
    const admin = await requireAdminPage(request, { requireActive: true });
    const form = await request.formData();
    const id = parseAdminBusVersionId(form);
    if (id === null) return failure(copy.invalidVersionId);
    const version = await prisma.busScheduleVersion.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!version) return failure(copy.versionNotFound, 404);
    await prisma.$transaction(async (tx) => {
      await tx.busScheduleVersion.updateMany({
        where: { id: { not: id } },
        data: { isEnabled: false },
      });
      await tx.busScheduleVersion.update({
        where: { id },
        data: { isEnabled: true },
      });
      await writeAuditLog(
        {
          action: "admin_bus_version_activate",
          channel: "web",
          userId: admin.id,
          requestId: locals.requestId,
          targetId: String(id),
          targetType: "bus_schedule_version",
        },
        tx,
      );
    });
    return success(copy.activated);
  },
  deleteVersion: async ({ locals, request }: AdminBusEvent) => {
    const copy = getCopy(locals.locale).adminBus;
    const admin = await requireAdminPage(request, { requireActive: true });
    const form = await request.formData();
    const id = parseAdminBusVersionId(form);
    if (id === null) return failure(copy.invalidVersionId);
    const version = await prisma.busScheduleVersion.findUnique({
      where: { id },
      select: { id: true, isEnabled: true },
    });
    if (!version) return failure(copy.versionNotFound, 404);
    if (version.isEnabled) return failure(copy.cannotDeleteActiveVersion);
    await prisma.$transaction(async (tx) => {
      await tx.busScheduleVersion.delete({ where: { id } });
      await writeAuditLog(
        {
          action: "admin_bus_version_delete",
          channel: "web",
          userId: admin.id,
          requestId: locals.requestId,
          targetId: String(id),
          targetType: "bus_schedule_version",
        },
        tx,
      );
    });
    return success(copy.deleted);
  },
  importStatic: async ({ locals, request }: AdminBusEvent) => {
    const copy = getCopy(locals.locale).adminBus;
    const admin = await requireAdminPage(request, { requireActive: true });
    let result: Awaited<ReturnType<typeof importBusStaticPayload>>;
    try {
      const payload = await loadBusStaticPayload();
      result = await importBusStaticPayload(prisma, payload);
      await writeAuditLog({
        action: "admin_bus_import",
        channel: "web",
        userId: admin.id,
        requestId: locals.requestId,
        targetId: String(result.versionId),
        targetType: "bus_schedule_version",
        metadata: {
          campuses: result.campuses,
          routes: result.routes,
          trips: result.trips,
        },
      });
    } catch (error) {
      logServerActionError("admin.bus.import-static.failed", error, {
        action: "import-static",
        requestId: locals.requestId,
        route: "/admin/bus",
      });
      return failure(copy.importFailed, 500);
    }
    return success(
      copy.importSummary
        .replace("{campuses}", String(result.campuses))
        .replace("{routes}", String(result.routes))
        .replace("{trips}", String(result.trips)),
    );
  },
};
