import { isWorkspaceDueOverdue } from "./date-formatters";

/** Use original timestamps; rounded timeline minutes cannot decide deadline state. */
export function overviewDeadlineOverdue(input: {
  dueAt: Date | string | null | undefined;
  reference: Date | string | null | undefined;
  completed?: boolean;
  completionRequired?: boolean;
}) {
  if (
    input.completed ||
    input.completionRequired === false ||
    !input.dueAt ||
    !input.reference
  )
    return false;
  return isWorkspaceDueOverdue(input.dueAt, input.reference);
}
