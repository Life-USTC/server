# Interface Hierarchy

This document records the navigation and command hierarchy shared by the
Life@USTC web app, REST API, GraphQL API, MCP server, Bot, and CLI. It defines
semantic consistency across those surfaces; it does not require identical
spelling where each interface has different conventions.

The server repository is the source of truth for Web, REST, GraphQL, and MCP.
Bot and CLI entries below are an integration snapshot and must be verified in
their own repositories before a breaking change.

## Hierarchy Rules

1. An independently navigable web page has a semantic path. Query parameters
   are reserved for filters, search, sort order, pagination, dates, and local
   view state.
2. The canonical web hierarchy is public pages at `/`, signed-in work at
   `/dashboard/*`, account preferences at `/settings/*`, and administration at
   `/admin/*`.
3. REST paths name resources. User ownership may be explicit under `/api/me/*`
   for aggregates, while resource collections such as `/api/todos` continue to
   enforce ownership in authorization. Existing paths are not bulk-renamed.
4. GraphQL keeps one transport endpoint, `/api/graphql`. Its schema hierarchy,
   not URL nesting, expresses domains and ownership through `viewer`, queries,
   and mutations.
5. MCP tool names are stable machine identifiers. They stay flat and
   verb-first, such as `list_my_todos`; renames require an alias and a
   deprecation window.
6. Bot and CLI commands are human interfaces. They use domain-first grouping,
   then an action: `待办 添加` and `workspace todo create`. Internal Bot tool
   names and OneBot action IDs are compatibility APIs, not navigation labels.
7. `subscription` is the canonical domain term. Web copy uses “教学班订阅 /
   Section subscriptions” with “订阅 / Subscribe” and “取消订阅 / Unsubscribe”.
   `calendar` or iCalendar names describe schedules and exported
   representations, not the act of subscribing to a section. “选课 /
   Enrollment” is reserved for official academic enrollment and disclaimers.
8. Locale is presentation preference, not content identity. Locale prefixes
   and locale query parameters are not canonical web routes.

## Current and Target Matrix

The table uses representative operations. It is an information-architecture
map, not an exhaustive endpoint or command reference.

| Domain | Web | REST | GraphQL | MCP | Bot | CLI | Direction |
|--------|-----|------|---------|-----|-----|-----|-----------|
| Public home | `/` | public catalog and bus resources under `/api/*` | public root queries | public discovery tools | public discovery commands | `catalog *` | Keep `/` small and anonymous; do not load signed-in dashboard data. |
| Overview | `/dashboard/overview` | `/api/me/overview` | `viewer.overview` | `get_my_overview`, `get_my_dashboard` | `日程 今日`, `日程 概览` | `me overview` | One signed-in overview concept; narrower resources remain separate. |
| Courses | `/courses`, `/courses/:jwId` | `/api/courses`, `/api/courses/:jwId` | `courses`, `course` | `search_courses`, `get_course_by_jw_id` | `课程 搜索`, `课程 查看` | `catalog course *` | `course` is the shared domain noun. |
| Sections | `/sections`, `/sections/:jwId` | `/api/sections`, `/api/sections/:jwId` | `sections`, `section` | `search_sections`, `get_section_by_jw_id` | `教学班 搜索`, `教学班 课表` | `catalog section *` | Do not call sections “courses” in mutation or subscription surfaces. |
| Teachers | `/teachers`, `/teachers/:id` | `/api/teachers`, `/api/teachers/:id` | `teachers`, `teacher` | `search_teachers`, `get_teacher_by_id` | catalog discovery | `catalog teacher *` | Public catalog domain. |
| Todos | `/dashboard/todos` | `/api/todos`, `/api/todos/:id` | `viewer.todos`, Todo mutations | `list_my_todos`, `create_my_todo`, `update_my_todo`, `delete_my_todo` | `待办 列表/添加/更新/删除` | `workspace todo *` | Read and write semantics should have parity across authenticated interfaces. |
| Homework | `/dashboard/homeworks` | `/api/homeworks*`, `/api/me/subscriptions/homeworks` | `viewer.homeworks`, homework mutations | homework list/write/completion tools | `作业 列表/完成/恢复` | `workspace homework *` | Distinguish the homework resource from a user's completion state. |
| Schedules | `/dashboard/calendar` | `/api/schedules`, `/api/me/subscriptions/schedules` | `viewer.schedules` | schedule and timeline tools | `课表 *`, `日程 *` | `workspace calendar *` | `calendar` may label a visual schedule, not section subscription ownership. |
| Subscriptions | `/dashboard/subscriptions` | `/api/calendar-subscriptions*` | `viewer.subscribedSections`, `subscribeSection`, `unsubscribeSection` | `list_my_subscribed_sections`, `subscribe_section_by_jw_id`, `unsubscribe_section_by_jw_id` | `订阅 列表/添加/删除` | currently `workspace calendar *` | Migrate CLI wording toward `workspace subscription *` with a compatibility alias; do not silently rename REST. |
| Bus | public `/bus`; signed-in `/dashboard/bus`; transit map `/bus-map` | `/api/bus*` | `busRoutes`, `busTimetable` | `list_bus_routes`, `search_bus_routes`, `get_next_buses` | bus domain commands | `catalog bus *` | Replace `/?tab=bus` as a canonical page; retain query compatibility temporarily. |
| Links | public `/links`; signed-in `/dashboard/links` | `/api/dashboard-links/*` | dashboard-link mutations | dashboard-link tools | — | `workspace link *` | Replace `/?tab=links` as a canonical page while the public directory remains independently navigable. |
| Profile and settings | `/u/:username`, `/settings/:section` | `/api/users/profile`, `/api/locale`, Better Auth routes | not required for protocol/auth operations | not required | `设置 *` where useful | `me`, `locale`, `auth` | Use semantic settings pages; protocol credentials do not need GraphQL or MCP parity. |
| Administration | `/admin`, `/admin/users`, `/admin/moderation`, `/admin/oauth`, `/admin/bus` | `/api/admin/*` plus OAuth-provider administration | intentionally omitted unless a concrete admin client needs it | intentionally omitted | intentionally omitted | `admin *` | Share one `/admin` secondary layout; avoid exposing privileged mutations merely for surface symmetry. |

## Web Route Policy

### Canonical paths

- `/` is the anonymous landing page.
- `/dashboard/overview` is the signed-in default.
- `/dashboard/{calendar,homeworks,todos,exams,subscriptions,bus,links}` are
  signed-in work areas.
- `/settings/<section>` contains account and preference sections.
- `/admin/<section>` contains privileged administration sections behind one
  shared secondary layout.
- `/bus` and `/links` are public applications independent of the landing page;
  `/bus-map` remains the distinct transit-map view.
- Catalog entities retain stable public paths such as `/courses/:jwId`,
  `/sections/:jwId`, and `/teachers/:id`.

### Query parameters

Query parameters are appropriate for state that does not create a distinct
resource:

- `?q=`, `?page=`, and filter or sort keys;
- calendar week, month, semester, or date selection;
- a list/grid display choice;
- a temporary success or error result after a form action.

They are not appropriate for choosing between independently navigable
applications. Current inputs such as `/?tab=bus`, `/?tab=links`,
`/dashboard?tab=todos`, and `/settings?tab=accounts` are compatibility inputs,
not canonical addresses.

For a query-tab migration:

1. Add and link the semantic path first.
2. Redirect safe `GET` and `HEAD` requests from the old query form to the
   semantic path while preserving unrelated filters.
3. Publish only the semantic URL in canonical metadata, navigation, sitemap,
   analytics dimensions, and tests.
4. Keep the compatibility redirect for at least one announced release, then
   remove it only after client and traffic review.

Route implementations should consume the route parameter directly. They should
not translate a semantic path back into an internal `tab` query parameter,
because that preserves the coupling the route migration is intended to remove.

## API and Command Compatibility

Consistency means the same domain noun, ownership rule, permission, mutation
effect, and error class—not identical path depth.

- The existing REST split between aggregates under `/api/me/*` and owned
  collections such as `/api/todos` is inconsistent in shape but not inherently
  incorrect. Inventory consumers before proposing aliases; do not perform a
  breaking bulk move to `/api/me/*`.
- `/api/calendar-subscriptions*` is deployed terminology. A future REST rename
  needs a measured compatibility alias and OpenAPI deprecation, even though
  `subscription` is the preferred product term.
- GraphQL mutations should reach business-operation parity with REST. Auth
  protocol endpoints, file byte transfer, and automatic CRUD generation remain
  outside that goal.
- MCP may execute arbitrary GraphQL documents through the shared production
  validation and resolver-authorization pipeline. Registered operations remain
  as stable compatibility shortcuts.
- Existing MCP names remain stable even where a human label changes.
- Bot shortcut aliases remain shortcuts. Help and primary command examples
  should present the domain-first form.
- CLI legacy paths should print the replacement and remain available for an
  announced compatibility release.

## Locale, Caching, and SEO

The canonical product URLs have no `/zh-cn`, `/en-us`, or locale query segment.
The server resolves locale from a signed-in preference or locale cookie, with
request language as a fallback.

This has an explicit SEO tradeoff: one unprefixed URL cannot truthfully be two
independently indexable language documents with separate canonical and
`hreflang` identities. Therefore:

- Chinese is the canonical indexable representation for shared public URLs.
- English is an adaptive user experience on the same URL, not a separate
  indexed locale URL.
- Public SSR metadata, sitemap entries, and structured data use the canonical
  representation consistently.
- HTML that varies by preference is private or varies on the smallest safe
  locale signal and is not stored in a shared cache without that cache key.
- JSON and GraphQL responses that localize text must include locale in their
  cache key or remain non-shared/private. Domain records should prefer
  locale-neutral data with localized presentation at the edge.
- A future requirement for independently indexed English pages requires a
  separate locale host or another explicit content identity. It cannot be
  solved only with cookies and cache headers.

## Change Checklist

Before changing any route, endpoint, field, tool, or command:

1. Identify the canonical domain noun in this document and the relevant
   `docs/contracts/*.json` module.
2. Classify the change as additive, compatible alias, deprecation, or breaking.
3. Inventory server callers plus Bot and CLI integrations for a renamed
   operation.
4. Verify permissions and mutation effects across every supported surface.
5. Update canonical links, sitemap/SEO metadata, API contracts, MCP descriptors,
   help text, and tests that represent the affected surface.
6. Prefer an alias plus measured removal window over an atomic cross-repository
   rename.
