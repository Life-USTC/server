import {
  buildCommentWhere,
  buildDescriptionWhere,
  buildHomeworkWhere,
  getModerationFilters,
} from "@/features/admin/server/admin-moderation-page-filters";
import { serializeAdminModerationPageData } from "@/features/admin/server/admin-moderation-page-serialization";
import { getAdminModerationReadData } from "@/features/admin/server/admin-moderation-read-data";
import {
  getPrismaClient,
  requireAdminPage,
} from "@/features/admin/server/admin-page-auth";

const MODERATION_PAGE_SIZE = 50;
const MODERATION_DESCRIPTION_PAGE_SIZE = 200;

export async function getAdminModerationPage(request: Request, url: URL) {
  await requireAdminPage(request);
  const prisma = await getPrismaClient();
  const { tab, search, status, descriptionContent, descriptionTarget } =
    getModerationFilters(url);

  const [comments, descriptions, homeworks, suspensions] =
    await getAdminModerationReadData({
      commentWhere: buildCommentWhere(status),
      descriptionPageSize: MODERATION_DESCRIPTION_PAGE_SIZE,
      descriptionWhere: buildDescriptionWhere(
        search,
        descriptionContent,
        descriptionTarget,
      ),
      homeworkWhere: buildHomeworkWhere(search),
      pageSize: MODERATION_PAGE_SIZE,
      prisma,
    });

  return serializeAdminModerationPageData({
    comments,
    descriptions,
    filters: { search, status, descriptionContent, descriptionTarget },
    homeworks,
    suspensions,
    tab,
  });
}
