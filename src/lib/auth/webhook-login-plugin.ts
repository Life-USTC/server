import { createAuthEndpoint } from "better-auth/api";
import * as z from "zod";
import { handleWebhookLogin } from "@/lib/auth/webhook-login-handler";

const webhookLoginBodySchema = z.object({
  secret: z.string().optional(),
  email: z.string().optional(),
  userId: z.string().optional(),
});

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
                "Debug-only webhook login endpoint backed by Better Auth session creation.",
            },
          },
        },
        (ctx) => handleWebhookLogin(ctx),
      ),
    },
  };
}
