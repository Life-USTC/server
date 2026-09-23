import { listSectionHomeworkAuditLogs } from "@/features/homeworks/server/homework-list-read-model";
import { withSubscribedSections } from "./subscription-read-model-shared";

export async function listSubscribedHomeworkAuditLogs(
  userId: string,
  limit = 50,
  sectionIds?: readonly number[],
) {
  return withSubscribedSections(
    userId,
    async (ids) => {
      return (await listSectionHomeworkAuditLogs(ids)).slice(0, limit);
    },
    sectionIds,
  );
}
