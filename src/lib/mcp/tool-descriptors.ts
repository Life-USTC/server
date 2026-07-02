import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { PUBLIC_REST_SCOPES } from "@/lib/oauth/scope-registry";
import { getRequiredMcpScopes } from "./tool-scopes";

type ToolSecurityScheme = {
  type: "oauth2";
  scopes: string[];
};

type ToolDescriptorDefaults = {
  title: string;
  outputSchema: typeof STRUCTURED_CONTENT_OUTPUT_SCHEMA;
  annotations: ToolAnnotations;
  _meta: {
    securitySchemes: ToolSecurityScheme[];
  };
};

const STRUCTURED_CONTENT_OUTPUT_SCHEMA = z
  .object({})
  .catchall(z.unknown())
  .describe("Open object returned in structuredContent.");

const OPEN_WORLD_WRITE_TOOLS = new Set([
  "add_comment_reaction",
  "create_comment",
  "create_homework_on_section",
  "delete_homework_on_section",
  "delete_own_comment",
  "remove_comment_reaction",
  "update_homework_on_section",
  "update_own_comment",
  "upsert_description",
]);

const DESTRUCTIVE_WRITE_PREFIXES = [
  "delete_",
  "remove_",
  "rename_",
  "save_",
  "set_",
  "unsubscribe_",
  "update_",
  "upsert_",
];

function humanizeToolName(name: string) {
  return name
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function isWriteScope(scope: string) {
  return scope.endsWith(":write");
}

function isDestructiveWriteTool(name: string) {
  return DESTRUCTIVE_WRITE_PREFIXES.some((prefix) => name.startsWith(prefix));
}

export function getMcpToolDescriptorDefaults(
  name: string,
): ToolDescriptorDefaults {
  const requiredScopes = getRequiredMcpScopes(name);
  const scopes =
    requiredScopes.length > 0 ? requiredScopes : [...PUBLIC_REST_SCOPES];
  const isWrite = scopes.some(isWriteScope);
  const title = humanizeToolName(name);

  return {
    title,
    outputSchema: STRUCTURED_CONTENT_OUTPUT_SCHEMA,
    annotations: {
      title,
      readOnlyHint: !isWrite,
      destructiveHint: isWrite && isDestructiveWriteTool(name),
      openWorldHint: isWrite && OPEN_WORLD_WRITE_TOOLS.has(name),
    },
    _meta: {
      securitySchemes: [{ type: "oauth2", scopes }],
    },
  };
}

export function installMcpToolDescriptorDefaults(server: McpServer) {
  const registerTool = server.registerTool.bind(server);

  server.registerTool = ((name, config, callback) => {
    const defaults = getMcpToolDescriptorDefaults(name);
    const mergedConfig = {
      ...config,
      title: config.title ?? defaults.title,
      outputSchema: config.outputSchema ?? defaults.outputSchema,
      annotations: {
        ...defaults.annotations,
        ...config.annotations,
      },
      _meta: {
        ...defaults._meta,
        ...config._meta,
        securitySchemes:
          config._meta?.securitySchemes ?? defaults._meta.securitySchemes,
      },
    } as typeof config;

    return registerTool(name, mergedConfig, callback);
  }) as typeof server.registerTool;
}
