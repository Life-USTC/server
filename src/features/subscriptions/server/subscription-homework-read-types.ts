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
  semesterId?: number;
  shape?: "full" | "dashboard";
};
