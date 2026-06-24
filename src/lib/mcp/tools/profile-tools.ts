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
    "get_my_profile",
    {
      description:
        "Return the authenticated user's Life@USTC profile: id, email, username, name, image, isAdmin, and timestamps.",
      inputSchema: getMyProfileInputSchema,
    },
    getMyProfileAction,
  );

  server.registerTool(
    "get_public_user_profile",
    {
      description:
        "Return a public Life@USTC user profile by username or userId, including visible stats and contribution heatmap data from the web profile page.",
      inputSchema: getPublicUserProfileInputSchema,
    },
    getPublicUserProfileAction,
  );

  server.registerTool(
    "list_my_todos",
    {
      description:
        "List todos. Incomplete items appear first by default. Returns counts (incomplete, completed, overdue) plus the todo list.",
      inputSchema: listMyTodosInputSchema,
    },
    listMyTodosAction,
  );

  server.registerTool(
    "create_my_todo",
    {
      description: "Create a new personal todo.",
      inputSchema: createMyTodoInputSchema,
    },
    createMyTodoAction,
  );

  server.registerTool(
    "update_my_todo",
    {
      description:
        "Update a todo by ID. Returns the updated todo snapshot. Only the owner can update.",
      inputSchema: updateMyTodoInputSchema,
    },
    updateMyTodoAction,
  );

  server.registerTool(
    "delete_my_todo",
    {
      description: "Delete a todo by ID. Only the owner can delete.",
      inputSchema: deleteMyTodoInputSchema,
    },
    deleteMyTodoAction,
  );
}
