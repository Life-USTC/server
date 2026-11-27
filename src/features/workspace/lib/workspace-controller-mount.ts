import { currentCatalogLinkReturnTo } from "./workspace-link-ui";

type WorkspaceMountCopy = {
  workspace: {
    linkHub: {
      pinFailedDescription: string;
    };
  };
};

export function mountWorkspaceController(input: {
  clearPendingRemoveSection: () => void;
  copy: WorkspaceMountCopy;
  replaceState: (href: string) => void;
  setLinkActionError: (value: string) => void;
  setLinkReturnTo: (value: string) => void;
}) {
  const url = new URL(window.location.href);
  input.setLinkReturnTo(currentCatalogLinkReturnTo());

  if (url.searchParams.get("workspaceLinkPinError") === "1") {
    input.setLinkActionError(input.copy.workspace.linkHub.pinFailedDescription);
    url.searchParams.delete("workspaceLinkPinError");
    const nextHref = `${url.pathname}${url.search}${url.hash}`;
    input.replaceState(nextHref);
    input.setLinkReturnTo(nextHref);
  }

  return () => {
    input.clearPendingRemoveSection();
  };
}
