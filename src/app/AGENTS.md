# src/app/

App Router pages and layouts.

## Scope

- Pages, layouts, route handlers
- Keep thin, business logic in `src/features/`

## App Router

```typescript
// params/searchParams may be Promises
export default async function Page({ params, searchParams }) {
  const { id } = await params;
  const { tab } = await searchParams;
}

// Metadata
export async function generateMetadata({ params }) {
  return { title: "..." };
}

// Set runtime only when needed
export const runtime = "nodejs"; // for MCP
export const dynamic = "force-dynamic"; // only if truly dynamic
```

## Page Contracts

- `/` - Dashboard (signed-in) or public (anon)
- `/courses`, `/sections`, `/teachers` - Public browsing
- `/welcome` - Required for new users
- `/settings` - Personal account management
- `/admin/*` - Admin only

## OpenAPI

```typescript
/**
 * @params coursesQuerySchema
 * @response paginatedCourseResponseSchema
 */
export async function GET(request: Request) {}
```

Run `bun run build:artifacts` after API changes.

See `api/AGENTS.md` for REST handlers, root `AGENTS.md` for patterns.
