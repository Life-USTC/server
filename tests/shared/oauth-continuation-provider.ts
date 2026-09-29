import { AsyncLocalStorage } from "node:async_hooks";

type ProviderCall = Readonly<{
  userId: string;
  signedIn: boolean;
  issueCode: (request: Request) => Promise<Response>;
}>;

export const authSecret =
  "oauth-authorization-continuation-test-secret-at-least-32-bytes";
export const providerContext = new AsyncLocalStorage<ProviderCall>();

function currentProvider() {
  const state = providerContext.getStore();
  if (!state) throw new Error("OAuth provider call outside its test fixture");
  return state;
}

export const betterAuthInstance = {
  $context: Promise.resolve({ secret: authSecret }),
  handler: (request: Request) => currentProvider().issueCode(request),
};

export async function getSessionFromHeaders() {
  const state = currentProvider();
  return state.signedIn ? { user: { id: state.userId } } : null;
}
