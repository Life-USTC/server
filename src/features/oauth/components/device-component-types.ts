import type { SubmitFunction } from "@sveltejs/kit";

export type DeviceCopy = {
  deviceApprove: string;
  deviceApprovedBadge: string;
  deviceApprovedDescription: string;
  deviceApprovedTitle: string;
  deviceApproveTitle: string;
  deviceClientRequest: string;
  deviceCodeExpired: string;
  deviceCodeHint: string;
  deviceCodeLabel: string;
  deviceCodeNotFound: string;
  deviceCodeUsed: string;
  deviceDeny: string;
  deviceDeniedBadge: string;
  deviceDeniedDescription: string;
  deviceDeniedTitle: string;
  deviceInvalidOrExpired: string;
  deviceMissingCode: string;
  deviceRequestedPermissions: string;
  deviceTitle: string;
  deviceTryAgain: string;
  deviceUnknownError: string;
  deviceVerify: string;
};

export type DeviceApprovalRequest = {
  clientName: string;
  scopes: string[];
  userCode: string;
};

export type DeviceDecisionAction = (
  decision: "approve" | "deny",
) => SubmitFunction;
