import type { RequestEvent } from "@sveltejs/kit";
import { importBusStaticPayload } from "@/features/bus/lib/bus-import";
import { loadBusStaticPayload } from "@/features/bus/lib/bus-static-source";
import type { AppLocale } from "@/i18n/config";
import { getAdminBusPage, requireAdminPage } from "@/lib/admin-page-data";
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
    await requireAdminPage(request);
    const form = await request.formData();
    const id = parseAdminBusVersionId(form);
    if (id === null) return failure(copy.invalidVersionId);
    const { prisma } = await import("@/lib/db/prisma");
    const version = await prisma.busScheduleVersion.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!version) return failure(copy.versionNotFound, 404);
    await prisma.$transaction([
      prisma.busScheduleVersion.updateMany({
        where: { id: { not: id } },
        data: { isEnabled: false },
      }),
      prisma.busScheduleVersion.update({
        where: { id },
        data: { isEnabled: true },
      }),
    ]);
    return success(copy.activated);
  },
  deleteVersion: async ({ locals, request }: AdminBusEvent) => {
    const copy = getCopy(locals.locale).adminBus;
    await requireAdminPage(request);
    const form = await request.formData();
    const id = parseAdminBusVersionId(form);
    if (id === null) return failure(copy.invalidVersionId);
    const { prisma } = await import("@/lib/db/prisma");
    const version = await prisma.busScheduleVersion.findUnique({
      where: { id },
      select: { id: true, isEnabled: true },
    });
    if (!version) return failure(copy.versionNotFound, 404);
    if (version.isEnabled) return failure(copy.cannotDeleteActiveVersion);
    await prisma.busScheduleVersion.delete({ where: { id } });
    return success(copy.deleted);
  },
  importStatic: async ({ locals, request }: AdminBusEvent) => {
    const copy = getCopy(locals.locale).adminBus;
    await requireAdminPage(request);
    const { prisma } = await import("@/lib/db/prisma");
    let result: Awaited<ReturnType<typeof importBusStaticPayload>>;
    try {
      const payload = await loadBusStaticPayload();
      result = await importBusStaticPayload(prisma, payload);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      return failure(`${copy.importFailed}: ${detail}`, 500);
    }
    return success(
      copy.importSummary
        .replace("{campuses}", String(result.campuses))
        .replace("{routes}", String(result.routes))
        .replace("{trips}", String(result.trips)),
    );
  },
};
