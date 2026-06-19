export {
  HOMEWORK_DESCRIPTION_MAX_LENGTH,
  HOMEWORK_TITLE_MAX_LENGTH,
} from "@/features/homeworks/lib/homework-limits";
export {
  TODO_CONTENT_MAX_LENGTH,
  TODO_TITLE_MAX_LENGTH,
} from "@/features/todos/lib/todo-limits";

export const TODO_PRIORITIES = new Set<string>(["low", "medium", "high"]);
