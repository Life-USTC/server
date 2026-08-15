# Account audit and OAuth activity research

Status: validated local prototype; not production-ready and not merged.

## Decision

Use three separate data paths:

1. `AuditLog`: append-only security and accountability events for sensitive
   operations. It may identify actor, subject, OAuth client, grant, session,
   request and target.
2. OAuth grant usage aggregates: per user + client + grant + day counters and
   `lastUsedAt`, without request targets or content. This powers the user's
   authorization page, including read-only client usage that should not create
   one audit row per request.
3. Product analytics: anonymous or cohort-level feature/channel/status/latency
   aggregates. It must not contain user, grant, session, token, content, search
   text or raw error values.

Do not expose the raw `AuditLog` model as an API.

## Confirmed findings

- Better Auth core `databaseHooks` cover user, session, account and
  verification records, but not plugin passkeys.
- Passkey creation, rename and deletion use the passkey plugin's raw adapter.
  Registration requires a fresh session; rename and deletion only require an
  ordinary session. The current default fresh-session window is 24 hours.
- Passkey verification callbacks run before persistence, so they cannot be
  treated as a final success event. A successful session-create hook and an
  allowlisted global after hook are both needed.
- JWTs already carry OAuth client, grant and usually session attribution. The
  baseline REST layer discarded all of it; GraphQL and MCP discarded part of
  it. The prototype preserves `client_id`/`azp`, grant and `sid`, and rejects
  conflicting client claims.
- The baseline admin REST guard accepted a bearer token with any feature scope
  when its subject happened to be an administrator. This contradicted the
  documented session-only admin contract. The prototype changes the guard to
  session-only and adds a regression test.
- Existing audit metadata included comment/description excerpts, full before
  and after description content, suspension reason text and object-storage
  keys. The prototype removes those values and retains structural facts such
  as changed fields, reason presence and byte size.
- `account.profile:read` currently exposes email and `isAdmin`. Email should
  require the standard `email` scope; administrator status should not be in
  the ordinary delegated profile projection.
- The public contribution heatmap currently includes personal homework
  completion dates. Personal workspace completion is not a public
  contribution and needs removal or an explicit opt-in privacy decision.
- Homework editing is already collaborative for any active signed-in user;
  deletion remains creator/admin-only. However, the specialized homework audit
  enum and UI only contain create/delete, while `updateHomework` writes no
  homework audit row. Add an `updated` event with actor, time and
  `changedFields`, or preferably remove the parallel specialized audit path and
  project public homework history from the unified structured audit source.

## Audit event model

The prototype adds:

- finite account, passkey, OAuth authorization and admin action values;
- `outcome`: `success`, `denied`, `failure`;
- `channel`: `web`, `rest`, `graphql`, `mcp`, `auth`, `webhook`, `system`;
- `subjectUserId`, separate from the actor `userId`;
- `oauthClientId`, `oauthGrantId`, `sessionId`, `requestId`;
- keyset pagination indexes for subject and subject + OAuth client.

`subjectUserId` uses `ON DELETE SET NULL`. OAuth client, grant and session IDs
do not use foreign keys so deletion or revocation cannot erase forensic
attribution. A retention/anonymization job must remove those correlation IDs
when their policy expires.

Metadata must be validated by an action-specific allowlist. A new action is
hidden from user-facing projections until explicitly classified.

Never store passwords, password hashes, access/refresh/ID tokens, verification
tokens, WebAuthn challenges/public keys, raw request bodies, content excerpts,
cookies, authorization codes, client secrets or raw errors.

## Write integration

Use Better Auth hooks only where they correspond to committed mutations:

- `session.create.after`: sign-in success, including passkey sign-in;
- `session.delete.after`: sign-out/session revoke success;
- `account.create/update/delete`: login-method link, credential change and
  unlink when the operation uses Better Auth;
- `user.update/delete`: account identity changes handled by Better Auth;
- allowlisted global `hooks.after`: rejected sign-in attempts and passkey CRUD
  final responses.

Database after hooks run after commit and are not atomic with the business
mutation. Audit writes must catch failures and send a durable alert or outbox
record. A hook failure must not turn a committed account change into a false
failure response.

Project-owned SQL/Prisma paths bypass Better Auth hooks. Profile updates,
settings unlink, account deletion, OAuth grant/update/revoke, calendar-token
rotation, role changes and admin OAuth-client changes require explicit audit
writes in their business services.

Sensitive operations must require recent authoritative authentication:

- delete or rename a passkey;
- unlink a login method;
- revoke all sessions or authorizations;
- rotate a calendar feed token;
- delete the account.

Do not trust a cached session for this check.

## Read surfaces

### User security activity

`/account/settings/security` is cookie-session-only. It shows the user's own
account security allowlist, time, result, client display name, normalized
device family and masked network. It never returns raw metadata, full IP/UA,
grant/session/request IDs, credentials or tokens.

The prototype's `listOwnAccountSecurityActivity` implements this projection.

### Current OAuth client activity

Provide a distinct `account.client-activity:read` capability. Do not generate
an unused `:write` counterpart. REST/GraphQL/MCP must derive user and client
from the verified principal; a request parameter cannot select another client.

The response only contains that client's events for that user: action,
outcome, channel, time and safe target category. It excludes login, sessions,
passkeys, other clients, IP/UA, metadata and internal correlation IDs.

The prototype's `listOAuthClientActivity` accepts an OAuth principal instead
of arbitrary user/client IDs and verifies the database isolation query.

The authorization-management list remains session-only. A third-party client
must never list or revoke grants belonging to other applications.

### Admin audit

`/admin/audit` remains session-only until a real service-account authority
model exists. It supports actor, subject, client, action, outcome, channel,
target and time filters. Content and full network values remain hidden by
default. Admin read access should use a restricted database view/function or
dedicated role rather than the current blanket runtime table SELECT grant.

### OAuth authorization page

Add client `lastUsedAt`, last channel, recent feature categories and 30-day
read/write/error counts from a per-grant daily aggregate. Do not infer usage
from token creation time and do not write an audit row for every read request.

## Product analytics

Keep Analytics Engine events low-cardinality and non-identifying:

- feature and operation category;
- channel (`web`, `rest`, `graphql`, `mcp`);
- authenticated mode;
- verified OAuth client ID only when client-level adoption is required;
- status class, latency bucket and day.

Do not add user ID, grant ID, session ID, target ID, route parameters, argument
values, content, search text, token values or raw error messages. Apply
small-cohort suppression before presenting client/user-segment comparisons.

Recommended admin dashboards are feature adoption, OAuth client adoption,
authorization-to-first-use conversion, read/write/error/latency trends,
retention cohorts and failed sensitive-operation rates. They are aggregate
views, not a per-user browsing timeline.

## Retention

Initial policy to confirm with product/legal owners:

- failed/denied authentication: 90 days;
- masked network and device classification: 90 days;
- user security activity: 180 days;
- admin/role/moderation security events: 400 days;
- raw product events: at most 30 days;
- product daily aggregates: 13 months;
- OAuth per-grant usage aggregate: grant lifetime plus 90 days.

Runtime only inserts audit events. Retention deletion belongs to a maintenance
role. Account deletion nulls actor/subject relations and a cleanup job removes
expired OAuth/session/request correlations.

## Delivery order

1. Ship the admin session-only fix and recent-auth guards.
2. Ship the structured audit schema, trusted request metadata, unified actor
   context and privacy-safe metadata changes.
3. Wire Better Auth hooks and explicit project-owned sensitive operations.
   Include collaborative homework/public-information edits without storing
   content bodies in the security audit.
4. Add the session-only security center and authorization `lastUsedAt` summary.
5. Refactor the OAuth scope registry to explicit capabilities, then add the
   read-only current-client activity surface across REST/GraphQL/MCP.
6. Add session-only admin audit search and retention jobs.
7. Add aggregate product/OAuth dashboards and update contracts/privacy copy.

## Local verification

- 81 migrations applied successfully to a fresh scratch database.
- Migration also applied successfully on the seeded research database.
- 357 unit test files / 2,182 tests passed.
- 3 relevant integration test files / 13 tests passed against PostgreSQL.
- Svelte/TypeScript check: 0 errors; 13 pre-existing warnings.
- PostgreSQL plans use the subject and subject + OAuth client keyset indexes.
