import { createHomeworkWorkspaceAction } from "@/features/workspace/server/workspace-homework-page-actions";
import {
  createTodoWorkspaceAction,
  updateTodoWorkspaceAction,
} from "@/features/workspace/server/workspace-todo-page-actions";

export const workspacePageActions = {
  createHomework: createHomeworkWorkspaceAction,
  createTodo: createTodoWorkspaceAction,
  updateTodo: updateTodoWorkspaceAction,
};
