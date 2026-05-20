# src/app/api/

REST route handlers.

## Pattern

```typescript
import {
  handleRouteError,
  jsonResponse,
  notFound,
  unauthorized,
} from "@/lib/api/helpers";
import { resolveApiUserId } from "@/lib/auth/helpers";

export async function GET(request: Request) {
  try {
    const userId = await resolveApiUserId(request);
    if (!userId) return unauthorized();

    // Validate, fetch, return
    const data = await fetchData();
    return jsonResponse(data);
  } catch (error) {
    return handleRouteError("Failed to fetch data", error);
  }
}
```

## Key Rules

- Export `dynamic = "force-dynamic"` unless `tools/dev/check/check-route-conventions.ts` allowlists the route.
- Return status responses, not redirects
- Use `jsonResponse()` for date serialization
- Validate with Zod schemas
- Check auth before mutations
- Use `buildPaginatedResponse()` for lists

## OpenAPI

```typescript
/**
 * @params coursesQuerySchema
 * @pathParams jwIdPathParamsSchema
 * @body homeworkCreateRequestSchema
 * @response idResponseSchema
 * @response 400:openApiErrorSchema
 */
export async function POST(request: Request) {}
```

Use schema names only; inline TypeScript object shapes are ignored by the generator. Run `bun run check:routes` and `bun run build:artifacts` after route changes.

See root `AGENTS.md` for auth, dates, errors, validation.
