import * as z from "zod";

export const oauthDeviceAuthorizationResponseSchema = z.object({
  device_code: z.string(),
  user_code: z.string(),
  verification_uri: z.string().url(),
  verification_uri_complete: z.string().url(),
  expires_in: z.number().int().min(1),
  interval: z.number().int().min(1),
});

export const oauthTokenResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.literal("Bearer"),
  expires_in: z.number().int().min(1),
  expires_at: z.number().int().min(1).optional(),
  refresh_token: z.string().optional(),
  scope: z.string().optional(),
  id_token: z.string().optional(),
});

export const oauthErrorResponseSchema = z.object({
  error: z.string(),
  error_description: z.string().optional(),
});
