import type { PersistedGraphqlOperationDefinition } from "../operation-types";
import { accountGraphqlOperationDefinitions } from "./account";
import { catalogGraphqlOperationDefinitions } from "./catalog";
import { communityGraphqlOperationDefinitions } from "./community";
import { workspaceGraphqlOperationDefinitions } from "./workspace";

const byId = new Map<string, PersistedGraphqlOperationDefinition>(
  [
    ...catalogGraphqlOperationDefinitions,
    ...accountGraphqlOperationDefinitions,
    ...communityGraphqlOperationDefinitions,
    ...workspaceGraphqlOperationDefinitions,
  ].map((op) => [op.id, op]),
);

const REGISTRY_ORDER = [
  "catalog.semester.list.v1",
  "catalog.semester.current.get.v1",
  "catalog.course.search.v1",
  "catalog.course.get.v1",
  "catalog.section.search.v1",
  "catalog.section.get.v1",
  "catalog.teacher.search.v1",
  "catalog.teacher.get.v1",
  "catalog.bus.route.list.v1",
  "catalog.bus.timetable.get.v1",
  "catalog.weather.get.v1",
  "catalog.young_event.list.v1",
  "catalog.young_event.get.v1",
  "account.profile.get.v1",
  "account.client_activity.get.v1",
  "community.user.get.v1",
  "workspace.overview.get.v1",
  "workspace.todo.list.v1",
  "workspace.subscription.list.v1",
  "workspace.homework.list.v1",
  "workspace.schedule.list.v1",
  "workspace.exam.list.v1",
  "workspace.todo.create.v1",
  "workspace.todo.update.v1",
  "workspace.todo.delete.v1",
  "workspace.todo.completions.set.v1",
  "workspace.todos.delete.v1",
  "community.section_homework.create.v1",
  "community.section_homework.update.v1",
  "community.section_homework.delete.v1",
  "workspace.homework.completion.set.v1",
  "workspace.homework.completions.set.v1",
  "workspace.subscription.add.v1",
  "workspace.subscription.remove.v1",
  "workspace.subscription.import.v1",
  "workspace.link.pin.set.v1",
  "workspace.link_pin.batch_set.v1",
  "workspace.bus_preferences.set.v1",
  "community.description.set.v1",
  "community.comment.create.v1",
  "community.comment.update.v1",
  "community.comment.delete.v1",
  "community.comments.delete.v1",
  "community.comment.reaction.add.v1",
  "community.comment.reaction.remove.v1",
  "workspace.upload.session.create.v1",
  "workspace.upload.complete.v1",
  "workspace.upload.rename.v1",
  "workspace.upload.delete.v1",
] as const;

export const persistedGraphqlOperationDefinitions: PersistedGraphqlOperationDefinition[] =
  REGISTRY_ORDER.map((id) => {
    const op = byId.get(id);
    if (!op) throw new Error(`Missing GraphQL operation definition: ${id}`);
    return op;
  });
