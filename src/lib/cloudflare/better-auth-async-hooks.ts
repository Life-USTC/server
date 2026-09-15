import { AsyncLocalStorage } from "node:async_hooks";

// Better Auth's default export caches an unawaited dynamic import at module
// scope. If a Worker request only loads auth modules, that request can finish
// before the promise settles and later requests hang awaiting it. Resolve the
// Workers-supported builtin statically instead of retaining request-bound work.
export async function getAsyncLocalStorage() {
  return AsyncLocalStorage;
}
