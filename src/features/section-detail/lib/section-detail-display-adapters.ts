import { homeworkAuditActionLabel, yesNoLabel } from "./display";
import type { HomeworkAuditLog } from "./section-detail-controller-helpers";

export function sectionHomeworkAuditActionLabel(
  action: string,
  copy: {
    auditCreated: string;
    auditDeleted: string;
  },
) {
  return homeworkAuditActionLabel(action, {
    created: copy.auditCreated,
    deleted: copy.auditDeleted,
  });
}

export function sectionHomeworkAuditActorName(
  log: HomeworkAuditLog,
  fallback: string,
) {
  return log.actor?.name ?? log.actor?.username ?? fallback;
}

export function sectionYesNoLabel(
  value: boolean | null | undefined,
  labels: { fallback: string; no: string; yes: string },
) {
  return yesNoLabel(value, labels);
}
