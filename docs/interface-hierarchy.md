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
│   │   └── import
│   ├── bus-preferences
│   ├── links
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
│   ├── preferences
│   │   ├── locale
│   │   └── notifications
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
| `account` | The current principal's profile, session, security, locale, notifications, and authorizations | Campus work or another user's public profile |
| `admin` | Moderation, user governance, OAuth client governance, and managed source data | Ordinary user workflows |

The following distinctions are contractual:

| Terms | Canonical meaning |
|---|---|
| `schedule` | A class meeting or schedule view composed from class meetings |
| `calendar` | A time-ordered aggregation of schedules, exams, homework, and todos |
| `subscription` | The current user's relationship to a section |
| `calendar feed` | An iCalendar representation exported from workspace data |
| `community section homework` | A shared homework record attached to a section |
| `workspace homework` | The current user's view and completion state for shared homework |
| `catalog link` | A public link-directory record |
| `workspace link` | The current user's pin or preference state for a catalog link |
| `workspace upload` | A file owned by the current user |
| `community attachment` | Shared content's authorized reference to a workspace upload |

## Surface Mapping

| Surface | Canonical form | Example |
|---|---|---|
| Capability ID | `<scope>_<domain>_<action>` | `workspace_todo_create` |
| Web | `/<scope>/<plural-resource>` | `/workspace/todos` |
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
├── link*
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
| `catalog_course_search` | `/catalog/courses` | `GET /api/catalog/courses` | `catalog.courses` | `课程 搜索` | `catalog course search` |
| `catalog_section_get` | `/catalog/sections/:jwId` | `GET /api/catalog/sections/:jwId` | `catalog.section` | `教学班 查看` | `catalog section get` |
| `catalog_bus_departure_next` | `/catalog/bus` | `GET /api/catalog/bus/next` | — | `校车 下一班` | `catalog bus` |
| `workspace_overview_get` | `/workspace/overview` | `GET /api/workspace/overview` | `workspace.overview` | `概览` | `workspace overview` |
| `workspace_calendar_event_list` | `/workspace/calendar` | — | — | `日程 今日/本周` | `workspace calendar events` |
| `workspace_schedule_list` | `/workspace/schedules` | `GET /api/workspace/schedules` | `workspace.schedules` | `课表` | `workspace schedule list` |
| `workspace_todo_create` | `/workspace/todos` | `POST /api/workspace/todos` | `todoCreate` | `待办 添加` | `workspace todo create` |
| `workspace_homework_completion_set` | `/workspace/homeworks` | `PUT /api/workspace/homeworks/:id/completion` | `homeworkCompletionSet` | `作业 完成/恢复` | `workspace homework complete/reopen` |
| `workspace_subscription_add` | `/workspace/subscriptions` | `POST /api/workspace/subscriptions` | `subscriptionAdd` | `订阅 添加` | `workspace subscription add` |
| `workspace_calendar_feed_export` | `/workspace/subscriptions` | `GET /api/community/users/:token/calendar.ics` | — | `日历 导出` | `workspace calendar feed` |
| `workspace_bus_preferences_set` | `/workspace/bus` | `POST /api/workspace/bus-preferences` | `busPreferencesSet` | `校车 偏好 设置` | `workspace bus-preferences set` |
| `community_comment_create` | target comment panel | `POST /api/community/comments` | `commentCreate` | `评论 添加` | `community comment create` |
| `community_description_set` | target editor | `POST /api/community/descriptions` | `descriptionSet` | `描述 更新` | `community description set` |
| `account_profile_get` | `/account/settings/profile` | `GET /api/account/profile` | `account.profile` | `账户 信息` | `account profile` |

Feature-specific contract modules in `docs/contracts/` contain the exhaustive
routes, fields, tools, permissions, and return shapes.

## Transport-Specific Exceptions

- Authentication redirects, OAuth endpoints, cookie writes, and raw upload
  bytes are transport operations, not business capabilities. They do not need
  GraphQL or MCP equivalents.
- Web routes may omit `/catalog` for the anonymous landing page only. Public
  resource pages use `/catalog/*`; signed-in work uses `/workspace/*`.
- Bot exposes deterministic commands only for frequent, short interactions.
  Its AI mode may reach long-tail capabilities through MCP.
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

Public courses and sections use `jwId` at external boundaries. Internal
database IDs are not accepted by GraphQL, MCP, Bot, or ordinary CLI commands.

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
