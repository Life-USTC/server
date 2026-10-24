import { getModerationFilters } from "@/features/admin/server/admin-moderation-page-filters";
import { serializeAdminModerationPageData } from "@/features/admin/server/admin-moderation-page-serialization";
import { getAdminModerationReadData } from "@/features/admin/server/admin-moderation-read-data";
import {
  getPrismaClient,
  requireAdminPage,
} from "@/features/admin/server/admin-page-auth";
import {
  moderationCommentWhere,
  moderationDescriptionWhere,
  moderationHomeworkWhere,
  moderationSuspensionWhere,
  moderationTableFilters,
} from "./admin-moderation-table-query";

const MODERATION_PAGE_SIZE = 50;
const MODERATION_DESCRIPTION_PAGE_SIZE = 200;

export async function getAdminModerationPage(request: Request, url: URL) {
  const admin = await requireAdminPage(request);
  const prisma = await getPrismaClient();
  const { tab, search, status, descriptionContent, descriptionTarget } =
    getModerationFilters(url);
  const filters = {
    ...moderationTableFilters(url),
    search,
    status,
    descriptionContent,
    descriptionTarget,
  };

  const [comments, descriptions, homeworks, suspensions] =
    await getAdminModerationReadData({
      adminUserId: admin.id,
      commentWhere: moderationCommentWhere(filters),
      descriptionPageSize: MODERATION_DESCRIPTION_PAGE_SIZE,
      descriptionWhere: moderationDescriptionWhere(filters),
      homeworkWhere: moderationHomeworkWhere(filters),
      suspensionWhere: moderationSuspensionWhere(filters),
      pageSize: MODERATION_PAGE_SIZE,
      prisma,
    });

  return serializeAdminModerationPageData({
    comments,
    descriptions,
    filters,
    homeworks,
    suspensions,
    tab,
  });
}
