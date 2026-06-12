import { getOAuthCopy } from "@/lib/oauth-copy";

const deviceCopyKeys = [
  "deviceTitle",
  "deviceApproveTitle",
  "deviceCodeLabel",
  "deviceCodeHint",
  "deviceClientRequest",
  "deviceRequestedPermissions",
  "deviceApprovedBadge",
  "deviceDeniedBadge",
  "deviceApprovedTitle",
  "deviceDeniedTitle",
  "deviceApprovedDescription",
  "deviceDeniedDescription",
  "deviceErrorTitle",
  "deviceCodeNotFoundTitle",
  "deviceCodeExpiredTitle",
  "deviceCodeUsedTitle",
  "deviceMissingCode",
  "deviceInvalidOrExpired",
  "deviceCodeNotFound",
  "deviceCodeExpired",
  "deviceCodeUsed",
  "deviceUnknownError",
  "deviceTryAgain",
  "deviceDeny",
  "deviceApprove",
  "deviceVerify",
] as const;

export type DeviceCopy = Pick<
  ReturnType<typeof getOAuthCopy>,
  (typeof deviceCopyKeys)[number]
>;

export function getDeviceCopy(locale: Parameters<typeof getOAuthCopy>[0]) {
  const oauthCopy = getOAuthCopy(locale);
  return Object.fromEntries(
    deviceCopyKeys.map((key) => [key, oauthCopy[key]]),
  ) as DeviceCopy;
}
