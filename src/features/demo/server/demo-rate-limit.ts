import { checkUserMutationRateLimit } from "@/lib/security/user-mutation-rate-limit";

export function checkDemoRateLimit(
  request: Request,
  action: "bootstrap" | "token" | "todo-create",
  sessionHash?: string,
) {
  return checkUserMutationRateLimit({
    action: `demo:${action}`,
    host: new URL(request.url).host,
    tier: "batch",
    userId: sessionHash ?? request.headers.get("cf-connecting-ip") ?? "unknown",
  });
}
