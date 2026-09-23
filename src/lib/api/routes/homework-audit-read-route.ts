import { listSectionHomeworkAuditLogs } from "@/features/homeworks/server/homework-list-read-model";
import {
  getRequestSearchParams,
  handleRouteError,
  jsonResponse,
  parseRouteSearchParams,
} from "@/lib/api/helpers";
import { resolveHomeworkRouteSectionIds } from "@/lib/api/routes/homework-route-helpers";
import { homeworkAuditQuerySchema } from "@/lib/api/schemas/request-schemas";

export async function getHomeworkAuditRoute(request: Request) {
  const parsedQuery = parseRouteSearchParams(
    getRequestSearchParams(request),
    homeworkAuditQuerySchema,
    "Invalid homework audit query",
  );
  if (parsedQuery instanceof Response) return parsedQuery;

  try {
    const sectionIds = await resolveHomeworkRouteSectionIds(parsedQuery);
    if (sectionIds instanceof Response) return sectionIds;

    const auditLogs = await listSectionHomeworkAuditLogs(sectionIds);
    return jsonResponse({ auditLogs });
  } catch (error) {
    return handleRouteError("Failed to fetch homework audit logs", error);
  }
}
