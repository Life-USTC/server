export type TodoWithDue = {
  completed: boolean;
  dueAt?: Date | string | null;
};

export type HomeworkWithDue = {
  submissionDueAt?: Date | string | null;
};

export type OverviewSource<
  Todo extends TodoWithDue,
  Homework extends HomeworkWithDue,
> = {
  todos?: Todo[] | null;
  overview?: {
    calendar?: {
      referenceDate?: Date | string | null;
    } | null;
    pendingHomeworks?: Homework[] | null;
  } | null;
};
