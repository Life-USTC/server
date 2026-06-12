export const betterAuthUserOptions = {
  additionalFields: {
    username: {
      type: "string",
      required: false,
    },
    isAdmin: {
      type: "boolean",
      defaultValue: false,
    },
    profilePictures: {
      type: "string[]",
      required: false,
      defaultValue: () => [] as string[],
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
