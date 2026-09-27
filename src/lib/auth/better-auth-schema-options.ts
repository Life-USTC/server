import type { BetterAuthOptions } from "better-auth";
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
    // These providers may omit a verified mailbox (notably USTC). Linking
    // proves the provider identity and an existing recent app session;
    // a matching email alone must never merge accounts.
    trustedProviders: ["oidc", "github", "google"],
    disableImplicitLinking: true,
    // User-initiated linking must support providers like USTC OIDC that do
    // not expose the user's email and therefore use a local fallback email.
    allowDifferentEmails: true,
    // The adapter enforces the atomic usable-provider/passkey invariant.
    // Better Auth's account-row count cannot recognize a remaining passkey.
    allowUnlinkingAll: true,
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
} satisfies NonNullable<BetterAuthOptions["account"]>;

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
