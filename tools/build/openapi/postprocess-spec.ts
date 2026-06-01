import { readFile, writeFile } from "node:fs/promises";
import { OPENAPI_SPEC_RELATIVE_PATH } from "../../../src/lib/openapi/spec";

type OpenApiDocument = {
  openapi?: string;
  info?: unknown;
  servers?: unknown;
  paths?: Record<string, Record<string, Record<string, unknown>>>;
  components?: unknown;
  tags?: Array<{ name: string; description?: string }>;
};

type OpenApiOperation = Record<string, unknown>;

const TAG_DESCRIPTIONS: Record<string, string> = {
  Admin: "Admin and moderation endpoints",
  Comments: "Comment threads, reactions, and moderation",
  Homeworks: "Homework management and completion status",
  Uploads: "Upload presign, finalize, and file management",
  Descriptions: "User-generated description content and history",
  Sections: "Course sections, calendars, and schedules",
  Courses: "Course catalog and search",
  Teachers: "Teacher directory and search",
  Schedules: "Schedules search and filtering",
  Semesters: "Semester listing and current semester",
  Calendar: "Calendar selections and exports",
  Bus: "Shuttle bus schedules and preferences",
  Todos: "Personal todo management",
  Metadata: "Metadata dictionaries for filters",
  Me: "Current user profile, subscriptions, and personal data",
  DashboardLinks: "Dashboard link pinning and click tracking",
  Locale: "Locale switching and locale cookies",
  OpenAPI: "OpenAPI document endpoint",
  Api: "General API endpoints",
};

const TAG_ORDER = [
  "Admin",
  "Comments",
  "Homeworks",
  "Uploads",
  "Descriptions",
  "Sections",
  "Courses",
  "Teachers",
  "Schedules",
  "Semesters",
  "Calendar",
  "Bus",
  "Todos",
  "Me",
  "DashboardLinks",
  "Locale",
  "Metadata",
  "OpenAPI",
  "Api",
];

const TAG_BY_SEGMENT: Record<string, string> = {
  comments: "Comments",
  homeworks: "Homeworks",
  uploads: "Uploads",
  descriptions: "Descriptions",
  sections: "Sections",
  courses: "Courses",
  teachers: "Teachers",
  schedules: "Schedules",
  semesters: "Semesters",
  "calendar-subscriptions": "Calendar",
  bus: "Bus",
  todos: "Todos",
  metadata: "Metadata",
  me: "Me",
  "dashboard-links": "DashboardLinks",
  locale: "Locale",
  openapi: "OpenAPI",
};

const SINGULAR_RESOURCE_NAMES: Record<string, string> = {
  comments: "Comment",
  homeworks: "Homework",
  uploads: "Upload",
  descriptions: "Description",
  sections: "Section",
  courses: "Course",
  teachers: "Teacher",
  schedules: "Schedule",
  semesters: "Semester",
  todos: "Todo",
  users: "User",
  suspensions: "Suspension",
  "calendar-subscriptions": "CalendarSubscription",
  "dashboard-links": "DashboardLink",
};

function getApiSegments(path: string) {
  return path.split("/").filter(Boolean).slice(1);
}

function toPascalCase(value: string) {
  return value
    .split(/[-_.]/g)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join("");
}

function getCollectionName(segment: string) {
  return toPascalCase(segment);
}

function getSingularName(segment: string) {
  return (
    SINGULAR_RESOURCE_NAMES[segment] ??
    getCollectionName(segment).replace(/s$/, "")
  );
}

function tagForPath(path: string): { name: string; description: string } {
  const segments = getApiSegments(path);
  const name =
    segments[0] === "admin"
      ? "Admin"
      : segments[0] === "users" && segments.at(-1) === "calendar.ics"
        ? "Calendar"
        : ((segments[0] ? TAG_BY_SEGMENT[segments[0]] : undefined) ?? "Api");

  return {
    name,
    description: TAG_DESCRIPTIONS[name] ?? TAG_DESCRIPTIONS.Api,
  };
}

function isOperationKey(key: string) {
  return [
    "get",
    "post",
    "put",
    "patch",
    "delete",
    "head",
    "options",
    "trace",
  ].includes(key);
}

function rewriteOperationId(
  method: string,
  path: string,
  currentId: string,
): string {
  const segments = getApiSegments(path);
  if (segments.length === 0) {
    return currentId;
  }

  const isAdmin = segments[0] === "admin";
  const resourceSegments = isAdmin ? segments.slice(1) : segments;
  const [resource, secondSegment, thirdSegment] = resourceSegments;
  const adminPrefix = isAdmin ? "Admin" : "";
  const hasResourceId = secondSegment?.startsWith("{") ?? false;

  if (!resource) {
    return currentId;
  }

  if (resource === "bus" && resourceSegments.length === 1 && method === "get") {
    return "queryBus";
  }

  if (resource === "bus" && secondSegment === "preferences") {
    return method === "get" ? "getBusPreferences" : "setBusPreferences";
  }

  if (
    !isAdmin &&
    resource === "descriptions" &&
    resourceSegments.length === 1
  ) {
    return method === "get" ? "getDescription" : "upsertDescription";
  }

  if (
    resource === "semesters" &&
    secondSegment === "current" &&
    method === "get"
  ) {
    return "getCurrentSemester";
  }

  if (resource === "metadata" && method === "get") {
    return "getMetadata";
  }

  if (resource === "locale" && method === "post") {
    return "setLocale";
  }

  if (resource === "openapi" && method === "get") {
    return "getOpenApiSpec";
  }

  if (
    resource === "me" &&
    secondSegment === "subscriptions" &&
    thirdSegment === "homeworks" &&
    method === "get"
  ) {
    return "getSubscribedHomeworks";
  }

  if (resource === "me" && resourceSegments.length === 1 && method === "get") {
    return "getMe";
  }

  if (resource === "dashboard-links" && secondSegment === "visit") {
    return method === "get" ? "visitDashboardLink" : "recordDashboardLinkVisit";
  }

  if (
    resource === "dashboard-links" &&
    secondSegment === "pin" &&
    method === "post"
  ) {
    return "pinDashboardLink";
  }

  if (resource === "calendar-subscriptions" && secondSegment === "current") {
    return "getCurrentCalendarSubscription";
  }

  if (
    resource === "calendar-subscriptions" &&
    resourceSegments.length === 1 &&
    method === "post"
  ) {
    return "setCalendarSubscription";
  }

  if (
    resource === "users" &&
    segments.at(-1) === "calendar.ics" &&
    method === "get"
  ) {
    return "getUserCalendar";
  }

  if (
    resource === "sections" &&
    secondSegment === "match-codes" &&
    method === "post"
  ) {
    return "matchSectionCodes";
  }

  if (
    resource === "sections" &&
    segments.at(-1) === "calendar.ics" &&
    method === "get"
  ) {
    return hasResourceId ? "getSectionCalendar" : "getSectionsCalendar";
  }

  if (
    resource === "sections" &&
    thirdSegment === "schedules" &&
    method === "get"
  ) {
    return "getSectionSchedules";
  }

  if (
    resource === "sections" &&
    thirdSegment === "schedule-groups" &&
    method === "get"
  ) {
    return "getSectionScheduleGroups";
  }

  if (
    resource === "uploads" &&
    secondSegment === "complete" &&
    method === "post"
  ) {
    return "completeUpload";
  }

  if (
    resource === "uploads" &&
    thirdSegment === "download" &&
    method === "get"
  ) {
    return "downloadUpload";
  }

  if (
    resource === "homeworks" &&
    thirdSegment === "completion" &&
    method === "put"
  ) {
    return "setHomeworkCompletion";
  }

  if (resource === "comments" && thirdSegment === "reactions") {
    return method === "post" ? "addCommentReaction" : "removeCommentReaction";
  }

  if (
    isAdmin &&
    resource === "comments" &&
    hasResourceId &&
    method === "patch"
  ) {
    return "moderateAdminComment";
  }

  if (!hasResourceId && resourceSegments.length === 1) {
    if (method === "get") {
      return `list${adminPrefix}${getCollectionName(resource)}`;
    }
    if (method === "post") {
      return `create${adminPrefix}${getSingularName(resource)}`;
    }
  }

  if (hasResourceId && resourceSegments.length === 2) {
    const verb =
      method === "get"
        ? "get"
        : method === "patch"
          ? "update"
          : method === "delete"
            ? "delete"
            : method === "put"
              ? "set"
              : method === "post"
                ? "create"
                : "";

    if (verb) {
      return `${verb}${adminPrefix}${getSingularName(resource)}`;
    }
  }

  return currentId;
}

function sortPathItemKeys(pathItem: Record<string, unknown>) {
  const operationOrder = [
    "get",
    "post",
    "put",
    "patch",
    "delete",
    "head",
    "options",
    "trace",
  ];

  const keys = Object.keys(pathItem);
  keys.sort((a, b) => {
    const ai = operationOrder.indexOf(a);
    const bi = operationOrder.indexOf(b);
    if (ai !== -1 || bi !== -1) {
      return (
        (ai === -1 ? Number.POSITIVE_INFINITY : ai) -
        (bi === -1 ? Number.POSITIVE_INFINITY : bi)
      );
    }
    return a.localeCompare(b);
  });

  const next: Record<string, unknown> = {};
  for (const key of keys) {
    next[key] = pathItem[key];
  }
  return next;
}

function buildTopLevelTags(paths: NonNullable<OpenApiDocument["paths"]>) {
  const byName = new Map<string, { name: string; description: string }>();
  for (const path of Object.keys(paths)) {
    const tag = tagForPath(path);
    byName.set(tag.name, tag);
  }

  const preferredOrder = TAG_ORDER;

  const tags = Array.from(byName.values());
  tags.sort((a, b) => {
    const ai = preferredOrder.indexOf(a.name);
    const bi = preferredOrder.indexOf(b.name);
    if (ai !== -1 || bi !== -1) {
      return (
        (ai === -1 ? Number.POSITIVE_INFINITY : ai) -
        (bi === -1 ? Number.POSITIVE_INFINITY : bi)
      );
    }
    return a.name.localeCompare(b.name);
  });

  return tags.map((t) => ({ name: t.name, description: t.description }));
}

function setRedirectResponse(
  operation: OpenApiOperation,
  statusCode: number,
  description: string,
) {
  operation.responses = {
    [String(statusCode)]: {
      description,
      headers: {
        Location: {
          description: "Redirect target URL",
          schema: { type: "string" },
        },
      },
    },
  };
}

function setFormRequestBody(operation: OpenApiOperation, schemaRef: string) {
  operation.requestBody = {
    required: true,
    content: {
      "application/x-www-form-urlencoded": {
        schema: {
          $ref: schemaRef,
        },
      },
    },
  };
}

function patchRedirectOperations(paths: NonNullable<OpenApiDocument["paths"]>) {
  const pinPost = paths["/api/dashboard-links/pin"]?.post as
    | OpenApiOperation
    | undefined;
  if (pinPost) {
    setFormRequestBody(
      pinPost,
      "#/components/schemas/dashboardLinkPinRequestSchema",
    );
    setRedirectResponse(pinPost, 303, "Redirect after pin/unpin");
  }

  const visitGet = paths["/api/dashboard-links/visit"]?.get as
    | OpenApiOperation
    | undefined;
  if (visitGet) {
    setRedirectResponse(visitGet, 307, "Temporary redirect to target link");
  }

  const visitPost = paths["/api/dashboard-links/visit"]?.post as
    | OpenApiOperation
    | undefined;
  if (visitPost) {
    setFormRequestBody(
      visitPost,
      "#/components/schemas/dashboardLinkVisitRequestSchema",
    );
    setRedirectResponse(visitPost, 303, "Redirect after recording link click");
  }
}

// ── Fix OpenAPI 3.1 → 3.0 exclusive min/max ─────────────────────────────────

/**
 * In OpenAPI 3.1 / JSON Schema 2020-12, exclusiveMinimum and exclusiveMaximum
 * are numbers. In 3.0 they are booleans and the threshold is set via
 * minimum / maximum. Zod's toJSONSchema emits the 3.1 form but we declare
 * 3.0, so we patch here.
 */
function fixExclusiveMinMax(obj: unknown): void {
  if (obj === null || typeof obj !== "object") return;
  if (Array.isArray(obj)) {
    for (const item of obj) fixExclusiveMinMax(item);
    return;
  }
  const record = obj as Record<string, unknown>;
  if (typeof record.exclusiveMinimum === "number") {
    record.minimum = record.exclusiveMinimum;
    record.exclusiveMinimum = true;
  }
  if (typeof record.exclusiveMaximum === "number") {
    record.maximum = record.exclusiveMaximum;
    record.exclusiveMaximum = true;
  }
  for (const value of Object.values(record)) {
    fixExclusiveMinMax(value);
  }
}

/**
 * Zod's toJSONSchema may emit `$defs` with `$ref: "#/$defs/..."` inside
 * component schemas. OpenAPI 3.0 doesn't support `$defs`, so we inline
 * every `$ref` that points at a `$defs` entry and then remove the key.
 *
 * For recursive schemas (e.g. comment replies referencing the comment schema),
 * we replace self-references with an empty object to break the cycle.
 */
function inlineDefs(obj: unknown): void {
  if (obj === null || typeof obj !== "object") return;
  if (Array.isArray(obj)) {
    for (const item of obj) inlineDefs(item);
    return;
  }
  const record = obj as Record<string, unknown>;
  const defs = record.$defs as Record<string, unknown> | undefined;
  if (defs && typeof defs === "object") {
    // Recursively resolve $ref: "#/$defs/..." inside this schema
    resolveLocalRefs(record, defs, 0);
    delete record.$defs;
  }
  for (const value of Object.values(record)) {
    inlineDefs(value);
  }
}

const MAX_INLINE_DEPTH = 3;

function resolveLocalRefs(
  obj: unknown,
  defs: Record<string, unknown>,
  depth: number,
): void {
  if (obj === null || typeof obj !== "object") return;
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const item = obj[i] as Record<string, unknown>;
      if (
        item &&
        typeof item.$ref === "string" &&
        item.$ref.startsWith("#/$defs/")
      ) {
        const defName = item.$ref.slice("#/$defs/".length);
        if (defs[defName] && depth < MAX_INLINE_DEPTH) {
          const inlined = JSON.parse(JSON.stringify(defs[defName]));
          resolveLocalRefs(inlined, defs, depth + 1);
          obj[i] = inlined;
        } else {
          // Recursive or too deep — replace with empty schema
          obj[i] = { type: "object", description: "(recursive)" };
        }
      } else {
        resolveLocalRefs(item, defs, depth);
      }
    }
    return;
  }
  const record = obj as Record<string, unknown>;
  for (const [key, value] of Object.entries(record)) {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      typeof (value as Record<string, unknown>).$ref === "string"
    ) {
      const ref = (value as Record<string, unknown>).$ref as string;
      if (ref.startsWith("#/$defs/")) {
        const defName = ref.slice("#/$defs/".length);
        if (defs[defName] && depth < MAX_INLINE_DEPTH) {
          const inlined = JSON.parse(JSON.stringify(defs[defName]));
          resolveLocalRefs(inlined, defs, depth + 1);
          record[key] = inlined;
        } else {
          record[key] = { type: "object", description: "(recursive)" };
        }
      }
    }
    resolveLocalRefs(value, defs, depth);
  }
}

/**
 * Convert OpenAPI 3.1 nullable patterns to 3.0 style.
 * 3.1: `anyOf: [{type: "string"}, {type: "null"}]`
 * 3.0: `{type: "string", nullable: true}`
 */
function fixAnyOfNullable(obj: unknown): void {
  if (obj === null || typeof obj !== "object") return;
  if (Array.isArray(obj)) {
    for (const item of obj) fixAnyOfNullable(item);
    return;
  }
  const record = obj as Record<string, unknown>;

  if (Array.isArray(record.anyOf) && record.anyOf.length === 2) {
    const variants = record.anyOf as Array<Record<string, unknown>>;
    const nullIdx = variants.findIndex(
      (v) =>
        typeof v === "object" &&
        v !== null &&
        (v as Record<string, unknown>).type === "null",
    );
    if (nullIdx !== -1) {
      const other = variants[1 - nullIdx];
      if (other && typeof other === "object") {
        // Replace this schema node in-place with the non-null variant + nullable: true
        delete record.anyOf;
        for (const [k, v] of Object.entries(other)) {
          record[k] = v;
        }
        record.nullable = true;
      }
    }
  }

  for (const value of Object.values(record)) {
    fixAnyOfNullable(value);
  }
}

/**
 * Simplify remaining anyOf unions that oapi-codegen can't handle.
 * - `anyOf: [{type: "string"}, {type: "number"}]` → `{type: "string"}`
 *   (Zod coerce patterns — server accepts both, string is most permissive)
 * - `anyOf: [{type: "integer"}, {type: "string"}, {type: "null"}]` → `{type: "string", nullable: true}`
 * - `anyOf: [{obj: prop: null}, {obj: prop: {...}}]` → `{obj: prop: {... nullable: true}}`
 */
function simplifyAnyOfUnions(obj: unknown): void {
  if (obj === null || typeof obj !== "object") return;
  if (Array.isArray(obj)) {
    for (const item of obj) simplifyAnyOfUnions(item);
    return;
  }
  const record = obj as Record<string, unknown>;

  if (Array.isArray(record.anyOf)) {
    const variants = record.anyOf as Array<Record<string, unknown>>;
    const types = variants
      .filter((v) => typeof v === "object" && v !== null && "type" in v)
      .map((v) => v.type as string);

    // Only simplify if all variants are simple type objects (no $ref, no complex schemas)
    const allSimple = variants.every(
      (v) =>
        typeof v === "object" &&
        v !== null &&
        "type" in v &&
        typeof v.type === "string",
    );

    if (allSimple && types.length >= 2) {
      const hasNull = types.includes("null");
      const nonNull = types.filter((t) => t !== "null");

      // Only simplify scalar type unions (string, number, integer, boolean)
      // Don't simplify object unions — they're genuine discriminated unions
      const scalarTypes = ["string", "number", "integer", "boolean"];
      const allScalar = nonNull.every((t) => scalarTypes.includes(t));

      if (allScalar) {
        // Pick the most permissive type: prefer "string" if present, else first non-null
        const chosen = nonNull.includes("string") ? "string" : nonNull[0];
        if (chosen) {
          delete record.anyOf;
          record.type = chosen;
          if (hasNull) {
            record.nullable = true;
          }
        }
      }
    }

    // Handle object-union nullable pattern:
    // anyOf: [{type:object, props:{x: {type:null}}}, {type:object, props:{x: {type:object,...}}}]
    // → {type:object, props:{x: {..., nullable:true}}}
    if (
      variants.length === 2 &&
      variants.every(
        (v) =>
          v.type === "object" &&
          v.properties &&
          typeof v.properties === "object",
      )
    ) {
      const [a, b] = variants;
      const propsA = a.properties as Record<string, Record<string, unknown>>;
      const propsB = b.properties as Record<string, Record<string, unknown>>;
      const keysA = Object.keys(propsA);
      const keysB = Object.keys(propsB);

      // Same keys — try to merge nullable properties
      if (
        keysA.length === keysB.length &&
        keysA.every((k) => keysB.includes(k))
      ) {
        const merged: Record<string, Record<string, unknown>> = {};
        let canMerge = true;

        for (const key of keysA) {
          const valA = propsA[key];
          const valB = propsB[key];
          if (valA?.type === "null" && valB?.type !== "null") {
            merged[key] = { ...valB, nullable: true };
          } else if (valB?.type === "null" && valA?.type !== "null") {
            merged[key] = { ...valA, nullable: true };
          } else if (JSON.stringify(valA) === JSON.stringify(valB)) {
            merged[key] = valA;
          } else {
            canMerge = false;
            break;
          }
        }

        if (canMerge) {
          delete record.anyOf;
          record.type = "object";
          record.properties = merged;
          // Use required from the variant with the real types
          record.required = b.required ?? a.required;
          record.additionalProperties = false;
        }
      }
    }
  }

  for (const value of Object.values(record)) {
    simplifyAnyOfUnions(value);
  }
}

async function main() {
  const filePath = new URL(
    `../../../${OPENAPI_SPEC_RELATIVE_PATH}`,
    import.meta.url,
  );
  const raw = await readFile(filePath, "utf8");
  const doc = JSON.parse(raw) as OpenApiDocument;

  if (!doc.paths || typeof doc.paths !== "object") {
    throw new Error("Invalid OpenAPI document: missing paths");
  }

  const paths = doc.paths;

  for (const [path, pathItem] of Object.entries(paths)) {
    if (!pathItem || typeof pathItem !== "object") {
      continue;
    }

    const tag = tagForPath(path);
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!isOperationKey(method)) {
        continue;
      }
      if (!operation || typeof operation !== "object") {
        continue;
      }
      (operation as { tags?: unknown }).tags = [tag.name];

      // Rewrite operationId to Go-friendly camelCase names
      const currentId = (operation as { operationId?: string }).operationId;
      if (currentId) {
        (operation as { operationId?: string }).operationId =
          rewriteOperationId(method, path, currentId);
      }
    }
  }

  const sortedPaths = Object.fromEntries(
    Object.entries(paths)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([path, pathItem]) => {
        if (!pathItem || typeof pathItem !== "object") {
          return [path, pathItem];
        }
        return [path, sortPathItemKeys(pathItem)];
      }),
  ) as NonNullable<OpenApiDocument["paths"]>;

  doc.paths = sortedPaths;
  patchRedirectOperations(sortedPaths);

  doc.tags = buildTopLevelTags(sortedPaths);

  // Fix OpenAPI 3.1-style exclusiveMinimum/exclusiveMaximum (number) to 3.0 (boolean)
  fixExclusiveMinMax(doc);

  // Inline $defs from Zod's JSON Schema output (not valid in OpenAPI 3.0)
  inlineDefs(doc);

  // Convert anyOf nullable patterns to OpenAPI 3.0 nullable: true
  fixAnyOfNullable(doc);

  // Simplify anyOf union types (e.g. string|number) to a single type for 3.0 compat
  simplifyAnyOfUnions(doc);

  await writeFile(filePath, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
}

await main();
