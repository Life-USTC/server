const HTTP_METHODS = ["get", "post", "put", "patch", "delete", "head"] as const;

type HttpMethod = (typeof HTTP_METHODS)[number];

type OpenApiOperation = {
  description?: string;
  operationId?: string;
  summary?: string;
  tags?: string[];
};

type OpenApiPathItem = {
  parameters?: unknown;
} & Partial<Record<HttpMethod | "options" | "trace", OpenApiOperation>>;

export type OpenApiDocument = {
  components?: Record<string, unknown>;
  info: Record<string, unknown> & { title?: string };
  openapi: string;
  paths: Record<string, OpenApiPathItem>;
  servers?: unknown[];
  tags?: Array<{
    description?: string;
    name: string;
    "x-displayName"?: string;
  }>;
  "x-tagGroups"?: Array<{ name: string; tags: string[] }>;
};

export type ApiDocsOperation = {
  href: string;
  method: HttpMethod;
  path: string;
  summary: string;
};

export type ApiDocsTag = {
  description: string;
  displayName: string;
  href: string;
  name: string;
  operations: ApiDocsOperation[];
  slug: string;
};

export type ApiDocsGroup = {
  name: string;
  tags: ApiDocsTag[];
};

export type ApiDocsSelection = {
  activeHref: string;
  document: OpenApiDocument;
  groups: ApiDocsGroup[];
  operation?: ApiDocsOperation;
  tag: ApiDocsTag;
};

const DOCS_BASE_PATH = "/api/docs";

export function getApiDocsSelection(
  document: OpenApiDocument,
  pathname: string,
): ApiDocsSelection {
  const groups = buildApiDocsGroups(document);
  const tags = groups.flatMap((group) => group.tags);
  const fallbackTag = tags[0];

  if (!fallbackTag) {
    return {
      activeHref: DOCS_BASE_PATH,
      document,
      groups,
      tag: {
        description: "",
        displayName: "API",
        href: DOCS_BASE_PATH,
        name: "API",
        operations: [],
        slug: "api",
      },
    };
  }

  const route = parseDocsPath(pathname);
  const tag =
    tags.find((candidate) => candidate.slug === route.tagSlug) ?? fallbackTag;
  const operation = tag.operations.find(
    (candidate) =>
      candidate.method === route.method && candidate.path === route.apiPath,
  );

  return {
    activeHref: operation?.href ?? tag.href,
    document: filterOpenApiDocument(document, tag, operation),
    groups,
    operation,
    tag,
  };
}

export function slugifyDocsSegment(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function buildApiDocsGroups(document: OpenApiDocument): ApiDocsGroup[] {
  const tags = new Map(
    (document.tags ?? []).map((tag) => [
      tag.name,
      {
        description: tag.description ?? "",
        displayName: tag["x-displayName"] ?? tag.name,
        href: `${DOCS_BASE_PATH}/tag/${slugifyDocsSegment(tag.name)}`,
        name: tag.name,
        operations: [] as ApiDocsOperation[],
        slug: slugifyDocsSegment(tag.name),
      },
    ]),
  );

  for (const [path, pathItem] of Object.entries(document.paths)) {
    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];
      const tagName = operation?.tags?.[0];
      const tag = tagName ? tags.get(tagName) : undefined;
      if (!operation || !tag) continue;
      const summary = operation.summary ?? operation.operationId ?? path;
      tag.operations.push({
        href: `${tag.href}/${method.toUpperCase()}${encodeApiPath(path)}`,
        method,
        path,
        summary,
      });
    }
  }

  const groupedTags = new Set<string>();
  const groups =
    document["x-tagGroups"]?.flatMap((group) => {
      const groupTags = group.tags
        .map((tagName) => tags.get(tagName))
        .filter((tag): tag is ApiDocsTag => Boolean(tag));
      for (const tag of groupTags) groupedTags.add(tag.name);
      return groupTags.length ? [{ name: group.name, tags: groupTags }] : [];
    }) ?? [];

  const ungroupedTags = [...tags.values()].filter(
    (tag) => !groupedTags.has(tag.name) && tag.operations.length,
  );
  if (ungroupedTags.length) groups.push({ name: "Other", tags: ungroupedTags });

  return groups;
}

function filterOpenApiDocument(
  document: OpenApiDocument,
  tag: ApiDocsTag,
  operation?: ApiDocsOperation,
): OpenApiDocument {
  const paths: OpenApiDocument["paths"] = {};

  for (const [path, pathItem] of Object.entries(document.paths)) {
    const filteredPathItem: OpenApiPathItem = {};
    if (pathItem.parameters) filteredPathItem.parameters = pathItem.parameters;

    for (const method of HTTP_METHODS) {
      const candidate = pathItem[method];
      const includeOperation = operation
        ? operation.method === method && operation.path === path
        : candidate?.tags?.includes(tag.name);
      if (candidate && includeOperation) filteredPathItem[method] = candidate;
    }

    if (HTTP_METHODS.some((method) => filteredPathItem[method])) {
      paths[path] = filteredPathItem;
    }
  }

  return {
    openapi: document.openapi,
    info: {
      ...document.info,
      title: operation
        ? `${operation.method.toUpperCase()} ${operation.path}`
        : tag.displayName,
    },
    servers: document.servers,
    paths,
    components: document.components,
    tags: [
      {
        name: tag.name,
        description: tag.description,
      },
    ],
    "x-tagGroups": [{ name: tag.displayName, tags: [tag.name] }],
  };
}

function parseDocsPath(pathname: string) {
  const docsPath = pathname.startsWith(`${DOCS_BASE_PATH}/`)
    ? pathname.slice(DOCS_BASE_PATH.length + 1)
    : "";
  const segments = docsPath.split("/").filter(Boolean).map(decodeSegment);

  if (segments[0] !== "tag") return {};

  const method = segments[2]?.toLowerCase();
  return {
    apiPath:
      segments.length > 3 ? `/${segments.slice(3).join("/")}` : undefined,
    method: isHttpMethod(method) ? method : undefined,
    tagSlug: segments[1],
  };
}

function encodeApiPath(path: string) {
  return path
    .split("/")
    .map((segment) => (segment ? encodeURIComponent(segment) : ""))
    .join("/");
}

function decodeSegment(segment: string) {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function isHttpMethod(method: string | undefined): method is HttpMethod {
  return HTTP_METHODS.some((candidate) => candidate === method);
}
