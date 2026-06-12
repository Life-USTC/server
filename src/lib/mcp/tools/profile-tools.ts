import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  createMyTodoAction,
  deleteMyTodoAction,
  getMyProfileAction,
  listMyTodosAction,
  updateMyTodoAction,
} from "@/lib/mcp/tools/profile-tool-actions";
import {
  createMyTodoInputSchema,
  deleteMyTodoInputSchema,
  getMyProfileInputSchema,
  listMyTodosInputSchema,
  updateMyTodoInputSchema,
} from "@/lib/mcp/tools/profile-tool-helpers";

export function registerProfileTools(server: McpServer) {
  server.registerTool(
    "get_my_profile",
    {
      description:
        "Return the authenticated user's Life@USTC profile: id, username, name, image, isAdmin, timestamps.",
      inputSchema: getMyProfileInputSchema,
    },
    getMyProfileAction,
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
