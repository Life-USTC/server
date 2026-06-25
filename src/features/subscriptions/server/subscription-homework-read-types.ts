export type ListSubscribedHomeworksOptions = {
  locale?: string;
  completed?: boolean;
  includeDeleted?: boolean;
  includeEditors?: boolean;
  limit?: number;
  dueAtFrom?: Date;
  dueAtTo?: Date;
  requireDueDate?: boolean;
  sectionIds?: readonly number[];
  shape?: "full" | "dashboard";
};
