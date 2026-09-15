export type ListSubscribedHomeworksOptions = {
  locale?: string;
  completed?: boolean;
  includeDeleted?: boolean;
  includeEditors?: boolean;
  incompleteOrHasDueDate?: boolean;
  limit?: number;
  now?: Date;
  dueAtFrom?: Date;
  dueAtTo?: Date;
  requireDueDate?: boolean;
  sectionIds?: readonly number[];
  semesterId?: number;
  shape?: "full" | "workspace";
};
