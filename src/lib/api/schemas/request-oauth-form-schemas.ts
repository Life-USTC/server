import * as z from "zod";

const formResourceSchema = z.union([
  z.string().trim().min(1),
  z.array(z.string().trim().min(1)),
]);

export const oauthDeviceAuthorizationRequestSchema = z.object({
  client_id: z.string().trim().min(1),
  resource: formResourceSchema.optional(),
  scope: z.string().trim().min(1).optional(),
});

export const oauthTokenRequestSchema = z.object({
  grant_type: z.string().trim().min(1),
  client_id: z.string().trim().min(1).optional(),
  client_secret: z.string().optional(),
  code: z.string().trim().min(1).optional(),
  code_verifier: z.string().trim().min(1).optional(),
  device_code: z.string().trim().min(1).optional(),
  redirect_uri: z.string().trim().min(1).optional(),
  refresh_token: z.string().trim().min(1).optional(),
  resource: formResourceSchema.optional(),
  scope: z.string().trim().min(1).optional(),
});
