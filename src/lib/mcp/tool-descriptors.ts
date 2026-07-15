import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  ListToolsRequestSchema,
  type ToolAnnotations,
} from "@modelcontextprotocol/sdk/types.js";
import { PUBLIC_REST_SCOPES } from "@/lib/oauth/scope-registry";
import {
  getMcpToolOutputSchema,
  getMcpToolOutputSchemaNames,
  hasMcpToolOutputSchema,
  type McpToolOutputSchema,
} from "./tool-output-schemas";
import {
  getExplicitMcpToolScopeNames,
  getRequiredMcpScopes,
  hasExplicitMcpToolScopes,
} from "./tool-scopes";

type ToolSecurityScheme = {
  type: "oauth2";
  scopes: string[];
};

type ToolDescriptorDefaults = {
  title: string;
  outputSchema: McpToolOutputSchema;
  annotations: ToolAnnotations;
  securitySchemes: ToolSecurityScheme[];
  _meta: {
    securitySchemes: ToolSecurityScheme[];
  };
};

type ProtocolRequestHandler = (
  request: unknown,
  extra: unknown,
) => unknown | Promise<unknown>;

type ProtocolServerWithHandlers = {
  _requestHandlers?: Map<string, ProtocolRequestHandler>;
  setRequestHandler: (
    requestSchema: typeof ListToolsRequestSchema,
    handler: ProtocolRequestHandler,
  ) => void;
};

type ToolDescriptorWithAuthMetadata = Record<string, unknown> & {
  _meta?: Record<string, unknown>;
  securitySchemes?: unknown;
};

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

const listCompatibilityInstalled = new WeakSet<McpServer>();
const registeredToolNames = new WeakMap<McpServer, Set<string>>();

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function addTopLevelSecuritySchemes(tool: ToolDescriptorWithAuthMetadata) {
  const schemes = isRecord(tool._meta) ? tool._meta.securitySchemes : undefined;
  if (tool.securitySchemes !== undefined || !Array.isArray(schemes)) {
    return tool;
  }

  return {
    ...tool,
    securitySchemes: schemes,
  };
}

export function installMcpToolListCompatibility(server: McpServer) {
  if (listCompatibilityInstalled.has(server)) return;

  const protocol = server.server as unknown as ProtocolServerWithHandlers;
  const listToolsHandler = protocol._requestHandlers?.get("tools/list");
  if (!listToolsHandler) return;

  protocol.setRequestHandler(ListToolsRequestSchema, async (request, extra) => {
    const result = await listToolsHandler(request, extra);
    if (!isRecord(result) || !Array.isArray(result.tools)) {
      return result;
    }

    return {
      ...result,
      tools: result.tools.map((tool) =>
        isRecord(tool) ? addTopLevelSecuritySchemes(tool) : tool,
      ),
    };
  });
  listCompatibilityInstalled.add(server);
}

export function getMcpToolDescriptorDefaults(
  name: string,
): ToolDescriptorDefaults {
  const requiredScopes = getRequiredMcpScopes(name);
  const scopes =
    requiredScopes.length > 0 ? requiredScopes : [...PUBLIC_REST_SCOPES];
  const isWrite = scopes.some(isWriteScope);
  const title = humanizeToolName(name);
  const securitySchemes: ToolSecurityScheme[] = [{ type: "oauth2", scopes }];

  return {
    title,
    outputSchema: getMcpToolOutputSchema(name),
    annotations: {
      title,
      readOnlyHint: !isWrite,
      destructiveHint: isWrite && isDestructiveWriteTool(name),
      openWorldHint: isWrite && OPEN_WORLD_WRITE_TOOLS.has(name),
    },
    securitySchemes,
    _meta: {
      securitySchemes,
    },
  };
}

export function installMcpToolDescriptorDefaults(server: McpServer) {
  const registerTool = server.registerTool.bind(server);
  const names = new Set<string>();
  registeredToolNames.set(server, names);

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
          config._meta?.securitySchemes ?? defaults.securitySchemes,
      },
    } as typeof config;

    const registered = registerTool(name, mergedConfig, callback);
    names.add(name);
    return registered;
  }) as typeof server.registerTool;
}

export function assertRegisteredMcpToolMetadata(server: McpServer) {
  const names = registeredToolNames.get(server);
  if (!names) {
    throw new Error("MCP descriptor defaults must be installed before tools");
  }

  const missingScopes = Array.from(names).filter(
    (name) => !hasExplicitMcpToolScopes(name),
  );
  const missingOutputSchemas = Array.from(names).filter(
    (name) => !hasMcpToolOutputSchema(name),
  );
  const unregisteredScopes = getExplicitMcpToolScopeNames().filter(
    (name) => !names.has(name),
  );
  const unregisteredOutputSchemas = getMcpToolOutputSchemaNames().filter(
    (name) => !names.has(name),
  );
  if (
    missingScopes.length === 0 &&
    missingOutputSchemas.length === 0 &&
    unregisteredScopes.length === 0 &&
    unregisteredOutputSchemas.length === 0
  ) {
    return;
  }

  const details = [
    missingScopes.length > 0
      ? `scope metadata: ${missingScopes.sort().join(", ")}`
      : null,
    missingOutputSchemas.length > 0
      ? `output schemas: ${missingOutputSchemas.sort().join(", ")}`
      : null,
    unregisteredScopes.length > 0
      ? `unregistered scope metadata: ${unregisteredScopes.sort().join(", ")}`
      : null,
    unregisteredOutputSchemas.length > 0
      ? `unregistered output schemas: ${unregisteredOutputSchemas.sort().join(", ")}`
      : null,
  ].filter(Boolean);
  throw new Error(`Registered MCP tools are missing ${details.join("; ")}`);
}
