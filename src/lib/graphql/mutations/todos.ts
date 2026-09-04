import type { TodoPriorityValue } from "@/features/todos/lib/todo-priority";
import {
  deleteTodosBatch,
  setTodoCompletionsBatch,
} from "@/features/todos/server/todo-batch-service";
import {
  createTodo,
  deleteOwnedTodo,
  updateOwnedTodo,
} from "@/features/todos/server/todo-service";
import type { GraphqlContext } from "../context";
import { requireGraphqlMutation } from "../mutation-guard";
import {
  dateTimeInput,
  normalizeTodoContent,
  normalizeTodoTitle,
  rejectExplicitNullFields,
  requireMutationId,
} from "../mutation-input";
import { handleTodoFailure, normalizeBatchIds } from "./shared";

type CreateTodoInput = {
  content?: string | null;
  dueAt?: string | null;
  priority?: TodoPriorityValue | null;
  title: string;
};

type UpdateTodoInput = {
  completed?: boolean | null;
  content?: string | null;
  dueAt?: string | null;
  priority?: TodoPriorityValue | null;
  title?: string | null;
};

type TodoCompletionBatchItemInput = {
  completed: boolean;
  todoId: string;
};

export const todoMutationResolvers = {
  async todoCreate(
    _parent: unknown,
    args: { input: CreateTodoInput },
    context: GraphqlContext,
  ) {
    const principal = await requireGraphqlMutation(context, "workspace.todo");
    rejectExplicitNullFields(args.input, ["priority"]);
    const todo = await createTodo({
      userId: principal.userId,
      title: normalizeTodoTitle(args.input.title),
      content: normalizeTodoContent(args.input.content),
      priority: args.input.priority ?? undefined,
      dueAt: dateTimeInput(args.input.dueAt),
    });
    return { id: todo.id };
  },
  async todoUpdate(
    _parent: unknown,
    args: { id: string; input: UpdateTodoInput },
    context: GraphqlContext,
  ) {
    const principal = await requireGraphqlMutation(context, "workspace.todo");
    rejectExplicitNullFields(args.input, ["title", "priority", "completed"]);
    const hasContent = Object.hasOwn(args.input, "content");
    const hasDueAt = Object.hasOwn(args.input, "dueAt");
    const result = await updateOwnedTodo({
      id: requireMutationId(args.id, "id"),
      userId: principal.userId,
      data: {
        completed: args.input.completed ?? undefined,
        content: hasContent
          ? normalizeTodoContent(args.input.content)
          : undefined,
        dueAt: hasDueAt ? dateTimeInput(args.input.dueAt) : undefined,
        hasContent,
        hasDueAt,
        priority: args.input.priority ?? undefined,
        title:
          args.input.title == null
            ? undefined
            : normalizeTodoTitle(args.input.title),
      },
    });
    if (!result.ok) handleTodoFailure(result);
    return { id: result.todo.id };
  },
  async todoDelete(
    _parent: unknown,
    args: { id: string },
    context: GraphqlContext,
  ) {
    const principal = await requireGraphqlMutation(context, "workspace.todo");
    const id = requireMutationId(args.id, "id");
    const result = await deleteOwnedTodo(id, principal.userId);
    if (!result.ok) handleTodoFailure(result);
    return { id, success: true };
  },
  async todoCompletionsSet(
    _parent: unknown,
    args: { items: TodoCompletionBatchItemInput[] },
    context: GraphqlContext,
  ) {
    const principal = await requireGraphqlMutation(context, "workspace.todo", {
      rateLimitTier: "batch",
    });
    const ids = normalizeBatchIds(
      args.items.map((item) => item.todoId),
      "todo IDs",
      100,
    );
    const results = await setTodoCompletionsBatch(
      principal.userId,
      args.items.map((item, index) => ({
        completed: item.completed,
        todoId: ids[index] as string,
      })),
    );
    return { results };
  },
  async todosDelete(
    _parent: unknown,
    args: { ids: string[] },
    context: GraphqlContext,
  ) {
    const principal = await requireGraphqlMutation(context, "workspace.todo", {
      rateLimitTier: "batch",
    });
    const ids = normalizeBatchIds(args.ids, "todo IDs", 100);
    const results = await deleteTodosBatch(principal.userId, ids);
    return { results };
  },
};
