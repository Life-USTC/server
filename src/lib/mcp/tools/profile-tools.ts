import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  createMyTodoAction,
  deleteMyTodoAction,
  getMyProfileAction,
  getPublicUserProfileAction,
  listMyTodosAction,
  updateMyTodoAction,
} from "@/lib/mcp/tools/profile-tool-actions";
import {
  createMyTodoInputSchema,
  deleteMyTodoInputSchema,
  getMyProfileInputSchema,
  getPublicUserProfileInputSchema,
  listMyTodosInputSchema,
  updateMyTodoInputSchema,
} from "@/lib/mcp/tools/profile-tool-helpers";

export function registerProfileTools(server: McpServer) {
  server.registerTool(
    "account_profile_get",
    {
      description:
        "Return the authenticated user's Life@USTC profile: id, email, username, name, image, isAdmin, and timestamps.",
      inputSchema: getMyProfileInputSchema,
    },
    getMyProfileAction,
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
