import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  createMyTodoInputSchema,
  deleteMyTodoInputSchema,
  getMyProfileInputSchema,
  getOAuthClientActivityInputSchema,
  getPublicUserProfileInputSchema,
  listMyTodosInputSchema,
  updateMyTodoInputSchema,
} from "@/lib/mcp/tools/workspace/profile-tool-helpers";
import { createMyTodoAction } from "./profile-tool-todo-create-action";
import { deleteMyTodoAction } from "./profile-tool-todo-delete-action";
import { listMyTodosAction } from "./profile-tool-todo-list-action";
import { updateMyTodoAction } from "./profile-tool-todo-update-action";
import {
  getMyProfileAction,
  getOAuthClientActivityAction,
  getPublicUserProfileAction,
} from "./profile-tool-user-actions";

export function registerProfileTools(server: McpServer) {
  server.registerTool(
    "account_profile_get",
    {
      description:
        "Return the authenticated user's Life@USTC profile. Email is included only with the standard email scope; administrative status is never disclosed to OAuth clients.",
      inputSchema: getMyProfileInputSchema,
    },
    getMyProfileAction,
  );

  server.registerTool(
    "account_client_activity_list",
    {
      description:
        "List security-relevant activity performed by this OAuth client for the authenticated user. Other clients, network addresses, devices, grants, and sessions are never returned.",
      inputSchema: getOAuthClientActivityInputSchema,
    },
    getOAuthClientActivityAction,
  );

  server.registerTool(
    "community_user_get",
    {
      description:
        "Return a public Life@USTC user profile by username or user ID, including visible stats and contribution heatmap data.",
      inputSchema: getPublicUserProfileInputSchema,
    },
    getPublicUserProfileAction,
  );

  server.registerTool(
    "workspace_todo_list",
    {
      description:
        "List todos. Incomplete items appear first by default. Returns counts (incomplete, completed, overdue) plus the todo list.",
      inputSchema: listMyTodosInputSchema,
    },
    listMyTodosAction,
  );

  server.registerTool(
    "workspace_todo_create",
    {
      description: "Create a new personal todo.",
      inputSchema: createMyTodoInputSchema,
    },
    createMyTodoAction,
  );

  server.registerTool(
    "workspace_todo_update",
    {
      description:
        "Update a todo by ID. Returns the updated todo snapshot. Only the owner can update.",
      inputSchema: updateMyTodoInputSchema,
    },
    updateMyTodoAction,
  );

  server.registerTool(
    "workspace_todo_delete",
    {
      description: "Delete a todo by ID. Only the owner can delete.",
      inputSchema: deleteMyTodoInputSchema,
    },
    deleteMyTodoAction,
  );
}
