import * as z from "zod";
import { isValidProfileUsername } from "@/features/profile/lib/profile-username";

export const betterAuthUserOptions = {
  additionalFields: {
    username: {
      type: "string",
      required: false,
      validator: {
        input: z.string().refine(isValidProfileUsername, {
          message: "Invalid username",
        }),
      },
    },
    isAdmin: {
      type: "boolean",
      input: false,
    },
    profilePictures: {
      type: "string[]",
      required: false,
      input: false,
    },
  },
} as const;

export const betterAuthAccountOptions = {
  accountLinking: {
    enabled: true,
    // User-initiated linking must support providers like USTC OIDC that do
    // not expose the user's email and therefore use a local fallback email.
    allowDifferentEmails: true,
  },
  fields: {
    providerId: "provider",
    accountId: "providerAccountId",
    accessToken: "access_token",
    refreshToken: "refresh_token",
    idToken: "id_token",
    scope: "scope",
    accessTokenExpiresAt: "accessTokenExpiresAt",
    refreshTokenExpiresAt: "refreshTokenExpiresAt",
    password: "password",
  },
} as const;

export const betterAuthSessionOptions = {
  storeSessionInDatabase: true,
  expiresIn: 60 * 60 * 24 * 30,
  updateAge: 60 * 60 * 24,
  fields: {
    token: "sessionToken",
    expiresAt: "expires",
    ipAddress: "ipAddress",
    userAgent: "userAgent",
  },
} as const;

export const betterAuthVerificationOptions = {
  modelName: "verificationToken",
  fields: {
    value: "token",
    expiresAt: "expires",
  },
} as const;
