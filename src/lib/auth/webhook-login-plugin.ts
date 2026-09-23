import { createAuthEndpoint } from "better-auth/api";
import * as z from "zod";
import { handleWebhookLogin } from "@/lib/auth/webhook-login-handler";

const webhookLoginBodySchema = z.object({
  secret: z.string().optional(),
  email: z.string().optional(),
  userId: z.string().optional(),
});

export const webhookLoginRateLimitRules = {
  "/webhook/login": {
    window: 60,
    max: 5,
  },
} as const;

export function webhookLoginPlugin() {
  return {
    id: "life-webhook-login",
    endpoints: {
      webhookLogin: createAuthEndpoint(
        "/webhook/login",
        {
          method: "POST",
          body: webhookLoginBodySchema,
          metadata: {
            openapi: {
              description:
                "Opt-in ops/debug webhook login. Requires WEBHOOK_LOGIN_ENABLED=true and WEBHOOK_SECRET. Sets a session cookie; does not return the session token in the body.",
            },
          },
        },
        (ctx) => handleWebhookLogin(ctx),
      ),
    },
  };
}
