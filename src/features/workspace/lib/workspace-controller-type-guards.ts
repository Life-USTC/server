import type {
  SignedWorkspaceData,
  WorkspacePageData,
} from "./workspace-controller-types";

export function isSignedWorkspaceData(
  data: WorkspacePageData,
): data is SignedWorkspaceData {
  return Boolean(data.signedIn && !data.userMissing);
}
