# Interface Hierarchy

This document defines the canonical information architecture shared by the
Life@USTC web app, REST API, GraphQL API, MCP server, Bot, and CLI. The same
capability keeps one scope, domain noun, ownership rule, permission, effect,
and error semantics on every surface. Each transport may use its native syntax.

The server repository is the source of truth for Web, REST, GraphQL, and MCP.
Bot and CLI entries are integration contracts verified in their repositories.

## Canonical Tree

```text
Life@USTC
├── catalog                         public campus facts
│   ├── metadata
│   ├── semesters
│   │   ├── list
│   │   └── current
│   ├── courses
│   │   ├── search
│   │   └── get
│   ├── sections
│   │   ├── search
│   │   ├── get
│   │   ├── match-preview
│   │   ├── schedules
│   │   └── exams
│   ├── teachers
│   │   ├── search
│   │   └── get
│   ├── schedules
│   ├── bus
│   │   ├── routes
│   │   ├── timetable
│   │   ├── next-departures
│   │   └── map
│   ├── young-events
│   │   ├── list
│   │   └── get
│   ├── weather
│   │   └── snapshot
│   ├── rooms
│   │   └── map
│   ├── publications                REST + ingestion; Web at /news
│   │   ├── list
│   │   ├── get
│   │   └── sources                 source registry directory; Web at /news/sources
│   └── links
├── workspace                       current user's campus work
│   ├── overview
│   ├── calendar
│   │   ├── events
│   │   └── feed
│   ├── schedules
│   │   └── next
│   ├── exams
│   ├── todos
│   │   ├── list / get
│   │   ├── create / update / delete
│   │   ├── completion-set
│   │   └── batch
│   ├── homeworks
│   │   ├── list
│   │   ├── completion-set
│   │   └── completions-set
│   ├── subscriptions
│   │   ├── list
│   │   ├── add / remove
│   │   ├── set
│   │   ├── preview
│   │   ├── import
│   │   └── kind-update
│   ├── bus-preferences
│   ├── link-pins
│   │   ├── list
│   │   └── pin-set
│   └── uploads
│       ├── list / create
│       └── rename / delete
├── community                       public identity and shared content
│   ├── users
│   ├── section-homeworks
│   ├── comments
│   │   └── reactions
│   ├── descriptions
│   └── attachments                 references to workspace uploads
├── account                         current principal identity and settings
│   ├── profile
│   ├── session
│   ├── sign-in / sign-out
│   ├── preferences                 locale only today
│   ├── client-activity
│   └── authorizations
└── admin                           platform governance
    ├── overview
    ├── users / suspensions
    ├── comments / descriptions / homeworks
    ├── oauth-clients
    └── bus-data
```

`me`, `viewer`, `my`, `own`, and `dashboard` are not formal hierarchy names.
They may appear in explanatory prose, but not in canonical routes, GraphQL
fields, MCP tools, capability IDs, or CLI command paths.

## Scope Boundaries

| Scope | Owns | Does not own |
|---|---|---|
| `catalog` | Public academic and transit facts | User state or shared user-authored content |
| `workspace` | The current user's todos, completion state, subscriptions, preferences, files, and derived schedule views | Identity, authentication, or globally shared records |
| `community` | Public user profiles and shared comments, descriptions, and section homework records | Private account data or file ownership |
| `account` | The current principal's profile, session, security, locale preferences, and authorizations | Campus work or another user's public profile |
| `admin` | Moderation, user governance, OAuth client governance, and managed source data | Ordinary user workflows |

The following distinctions are contractual:

| Terms | Canonical meaning |
|---|---|
| `schedule` | A class meeting or schedule view composed from class meetings |
| `calendar` | A time-ordered aggregation of schedules, exams, homework, todos, and subscribed activities |
| `subscription` | The current user's relationship to a section |
| `calendar feed` | An iCalendar representation exported from workspace data |
| `community section homework` | A shared homework record attached to a section |
| `workspace homework` | The current user's view and completion state for shared homework |
| `catalog link` | A public link-directory record |
| `workspace link pin` | The current user's pin or preference state for a catalog link |
| `workspace upload` | A file owned by the current user |
| `community attachment` | Shared content's authorized reference to a workspace upload |

## Surface Mapping

| Surface | Canonical form | Example |
|---|---|---|
| Capability ID | `<scope>_<domain>_<action>` | `workspace_todo_create` |
| Web | `/<scope>/…` | `/workspace/todos` (signed-in tabs: overview, calendar, homeworks, todos, exams, subscriptions) |
| REST | `/api/<scope>/<plural-resource>` | `/api/workspace/todos` |
| GraphQL query | `<scope>.<field>` | `workspace.todos` |
| GraphQL mutation | `<domain><Action>` | `todoCreate` |
| GraphQL operation ID | `<scope>.<domain>.<action>.v1` | `workspace.todo.create.v1` |
| MCP | Capability ID verbatim | `workspace_todo_create` |
| Bot | `<Chinese domain> <Chinese action>` | `待办 添加` |
| Bot extension action | `life_ustc.<capability_id>` | `life_ustc.workspace_todo_list` |
| CLI | `<scope> <domain> <action>` | `workspace todo create` |

GraphQL queries use real object hierarchy rather than underscore-encoded RPC
names. Mutation fields remain at the root because GraphQL only guarantees
serial execution for root mutation fields. A mutation's capability ID still
contains its full scope.

```text
Query
├── catalog
├── workspace
├── community
└── account

Mutation
├── todo*
├── homework*
├── subscription*
├── comment*
├── description*
├── busPreferences*
├── linkPin*
└── upload*
```

`catalog` and public `community` reads are available anonymously. `workspace`
and `account` return null when there is no authenticated principal. `admin` is
not exposed through GraphQL or MCP unless a concrete governance client and
threat model are approved.

## Canonical Actions

| Action | Meaning |
|---|---|
| `get` | Read one object by a unique identifier |
| `list` | Read a bounded, filterable collection |
| `search` | Perform keyword or fuzzy discovery |
| `preview` | Calculate a match or change without side effects |
| `create` | Create a new entity |
| `update` | Partially change entity attributes |
| `delete` | Delete an entity |
| `set` | Idempotently set a state or complete collection |
| `add` / `remove` | Change membership in a collection |
| `import` / `export` | Move data across a system or representation boundary |

Service identifiers do not use `view`, `query`, or `by_id`. Human interfaces
may adapt actions without changing semantics: CLI `complete` / `reopen` and Bot
“完成” / “恢复” map to the capability action `completion_set`.

Plural capability domains are reserved for genuinely batch operations:
`workspace_todo_delete` is single-item and
`workspace_todos_delete` is batch. Inputs, payloads, partial-success behavior,
and retry guidance must make the distinction explicit.

## Representative Cross-Surface Contract

| Capability ID / MCP | Web | REST | GraphQL | Bot | CLI |
|---|---|---|---|---|---|
| `catalog_course_search` | `/catalog/courses` | `GET /api/catalog/courses` | `catalog.courses` | `课程 搜索` | `catalog course --search <query>` |
| `catalog_section_get` | `/catalog/sections/:jwId` | `GET /api/catalog/sections/:jwId` | `catalog.section` | `教学班 查看` | `catalog section get` |
| `catalog_bus_departure_next` | `/catalog/bus` | `GET /api/catalog/bus/next` | — | `校车 下一班` | `catalog bus` |
| bus map (Web-only) | `/catalog/bus/map` | — | — | — | — |
| `catalog_link_list` | `/catalog/links` | `GET /api/catalog/links` | `catalog.links` | — | `catalog link` |
| `catalog_young_event_list` / `catalog_young_event_get` | `/catalog/young-events` | `GET /api/catalog/young-events`, `GET /api/catalog/young-events/:youngId` | `catalog.youngEvents`, `catalog.youngEvent` | `第二课堂` / `第二课堂 查看 <youngId>` | `catalog young-event list/get` |
| `catalog_weather_get` | `/catalog/weather` | `GET /api/catalog/weather` | `catalog.weather` | `天气` / `天气 高新` | `catalog weather` |
| `catalog_rooms_map` | `/catalog/rooms` | `GET /api/catalog/rooms/:code/map` | `catalog.roomMap` | `教室 <code>` or a recognized bare room code | `catalog room map <code>` |
| `workspace_overview_get` | `/workspace/overview` | `GET /api/workspace/overview` | `workspace.overview` | `概览` | `workspace overview` |
| `workspace_calendar_event_list` | `/workspace/calendar` | `GET /api/workspace/calendar/events` | `workspace.calendarEvents` | `日程 今日/本周` | `workspace calendar events` |
| `workspace_schedule_list` | `/workspace/overview` (no dedicated schedules tab) | `GET /api/workspace/schedules` | `workspace.schedules` | `课表` | `workspace schedule list` |
| `workspace_todo_create` | `/workspace/todos` | `POST /api/workspace/todos` | `todoCreate` | `待办 添加` | `workspace todo create` |
| `workspace_homework_completion_set` | `/workspace/homeworks` | `PUT /api/workspace/homeworks/:id/completion` | `homeworkCompletionSet` | `作业 完成/恢复` | `workspace homework complete/reopen` |
| `workspace_subscription_add` | `/workspace/subscriptions` | `PATCH /api/workspace/subscriptions` | `subscriptionAdd` | `订阅 添加` | `workspace subscription add` |
| `workspace_subscription_kind_update` | `/workspace/subscriptions` | `PATCH /api/workspace/subscriptions/:jwId` | `subscriptionKindUpdate` | `订阅 身份 <jwId> <普通\|助教\|旁听>` | `workspace subscription kind <jwId> <kind>` |
| `workspace_calendar_feed_get` | `/workspace/subscriptions` | `GET /api/calendar-feeds/:credential.ics` | — | `订阅 链接` | `workspace calendar feed` |
| `workspace_bus_preferences_set` | `/catalog/bus` | `POST /api/workspace/bus-preferences` | `busPreferencesSet` | `校车 偏好 设置` | `workspace bus-preferences set` |
| `workspace_link_pin_set` | `/catalog/links` | `POST /api/workspace/link-pins` | `linkPinSet` | — | `workspace link-pin pin/unpin` |
| `community_comment_create` | target comment panel | `POST /api/community/comments` | `commentCreate` | — | `community comment create` |
| `community_description_set` | target editor | `POST /api/community/descriptions` | `descriptionSet` | — | `community description set` |
| `account_profile_get` | `/account/settings/profile` | `GET /api/account/profile` | `account.profile` | `账户 信息` | `account profile` |
| `account_client_activity_list` | `/account/settings/security` | `GET /api/account/client-activity` | `account.clientActivity` | — | `account client activity` |

The first column is the capability ID (also the MCP name where exposed), not
a promise that Bot exposes that tool. The bus map is Web-only. A dash in a client column means there is no dedicated command.
`workspace_calendar_feed_get` returns credential-free subscription information;
the Bot and CLI feed commands use REST with `workspace.subscription:read`
to retrieve subscription information, plus `workspace.calendar-feed:read` to
include a private URL. The MCP tool requires `workspace.subscription:read`
and never includes that URL.

Complete personal calendar clients use `GET /api/workspace/calendar/events`,
`workspace.calendarEvents`, or `workspace_calendar_event_list` and the same
Shanghai date bounds. REST and GraphQL clients exhaust pagination instead of
using the bounded overview as a calendar dataset. Individual Young event
subscriptions add activities to this calendar and ICS; organizer follows only
produce daily new-event digests. See `contracts/young-workspace.json` for the
owner-scoped subscription and notification interfaces.

Feature-specific contract modules in `docs/contracts/` contain the exhaustive
routes, fields, tools, permissions, and return shapes.

## Transport-Specific Exceptions

- Authentication redirects, OAuth endpoints, cookie writes, and raw upload
  bytes are transport operations, not business capabilities. They do not need
  GraphQL or MCP equivalents.
- Web routes may omit `/catalog` for the anonymous landing page only. Public
  resource pages use `/catalog/*`; signed-in work uses `/workspace/[tab]`
  (`overview`, `calendar`, `homeworks`, `todos`, `exams`, `subscriptions`) plus
  nested paths such as `/workspace/subscriptions`. Tree entries like
  `workspace/schedules` or `workspace/uploads` are API/MCP/CLI capabilities and
  do not imply a matching Web page.
- Bot exposes deterministic commands for frequent, short interactions. Its AI
  mode also discovers all tools published by the configured server MCP session
  through `search_campus_tools` / `call_campus_tool`, using per-user MCP OAuth.
  There is no client tool-name allowlist: schemas and read/write annotations
  come from the server. Private MCP mutations use Bot's durable confirmation
  and execution records; interrupted writes with an uncertain result are not
  automatically replayed. Server scopes and ownership checks still apply.
  MCP resource and prompt readers supply the GraphQL schema and operation
  planning context. Shared conversations retain public host commands and do
  not expose MCP tools, resources, or prompts.
- CLI-local configuration and Bot-local AI/tool settings are client state and
  remain outside the server capability tree.
- Administration remains Web, REST, and CLI only by default. Surface symmetry
  is not permission to expose governance through GraphQL, MCP, or Bot.

## Semantic Parity

Matching names are insufficient. A capability is aligned only when every
surface agrees on:

1. ownership and required permission or OAuth scope;
2. identifiers and accepted filters;
3. pagination bounds and default ordering;
4. Asia/Shanghai date boundaries and output timezone;
5. mutation atomicity, partial-success shape, and idempotency;
6. stable error class and not-found behavior;
7. response freshness and mutation return snapshot;
8. confirmation and retry guidance for destructive or timeout-ambiguous writes.

OAuth feature scopes use the complete canonical feature name, for example
`community.comment:write`, `workspace.subscription:write`, and
`workspace.upload:write`. Short forms such as `comment:write` are not accepted.
Contract `required_scopes` are checked against the OAuth registry and native
MCP equivalents by `graphql-contract-parity.test.ts`.

Public course/section lookups and subscription-kind updates use `jwId` at
external boundaries. CLI subscription `add`, `remove`, and `preview` still
interpret numeric references as database section IDs, as does their REST batch
payload's `sectionIds`. Use section/course codes for these CLI commands to
avoid confusing those IDs with the JW IDs used by `subscription kind` and
catalog detail commands. GraphQL and native MCP subscription add/remove use
JW IDs; Bot add/remove use section codes.

## Locale, Caching, and SEO

Canonical product URLs have no locale prefix or locale query segment. Locale is
a presentation preference, not content identity.

- Chinese is the canonical indexable representation for shared public URLs.
- English is an adaptive experience on the same URL, not a separately indexed
  document.
- Localized responses are private or vary on a safe locale cache key.
- Domain records prefer locale-neutral values with presentation localized at
  the edge.

## Change Checklist

Before changing a route, field, tool, or command:

1. Identify its canonical scope, noun, action, and capability ID.
2. Update the feature contract module and every affected public schema.
3. Verify permissions, mutation effects, and errors across supported surfaces.
4. Update Web links, OpenAPI, GraphQL SDL, MCP descriptors, Bot help, CLI help,
   and their tests.
5. Run contract, schema, integration, client, and deployment checks appropriate
   to the affected surfaces.

Client OpenAPI synchronization checks only the generated REST contract. It does
not prove that a command is registered, its flags expose new filters, its table
shows new fields, or Bot's MCP allowlist admits a server tool. Review those
entrypoints separately, including help text and private/shared conversation
policy. A pinned server commit may predate the current release while its
OpenAPI content is still identical; compare content before updating provenance.
