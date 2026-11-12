type Options = {
  isCurrent: () => boolean;
  isAllowed: (url: URL) => boolean;
  reason: string;
};
/** Native links only: this is not a sandbox for third-party script. */
export function guardDemoDocumentLinks(
  root: HTMLElement,
  options: Options,
): () => void {
  const changed = new Map<HTMLAnchorElement, Map<string, string | null>>();
  const attributes = [
    "href",
    "aria-disabled",
    "aria-description",
    "tabindex",
    "title",
  ];
  const allowed = (href: string) => {
    try {
      return (
        options.isCurrent() &&
        options.isAllowed(new URL(href, root.ownerDocument.baseURI))
      );
    } catch {
      return false;
    }
  };
  const set = (anchor: HTMLAnchorElement, name: string, value: string) => {
    if (anchor.getAttribute(name) !== value) anchor.setAttribute(name, value);
  };
  function inspect() {
    for (const anchor of root.querySelectorAll<HTMLAnchorElement>("a[href]")) {
      const href = anchor.getAttribute("href");
      if (href === null || allowed(href)) continue;
      if (!changed.has(anchor))
        changed.set(
          anchor,
          new Map(attributes.map((name) => [name, anchor.getAttribute(name)])),
        );
      else changed.get(anchor)?.set("href", href);
      anchor.removeAttribute("href");
      set(anchor, "aria-disabled", "true");
      set(anchor, "aria-description", options.reason);
      set(anchor, "tabindex", "-1");
      set(anchor, "title", options.reason);
    }
  }
  const capture = (event: Event) => {
    if (event instanceof KeyboardEvent && !["Enter", " "].includes(event.key))
      return;
    const anchor = event
      .composedPath()
      .find(
        (node): node is HTMLAnchorElement =>
          node instanceof HTMLAnchorElement && root.contains(node),
      );
    if (!anchor) return;
    const href = anchor.getAttribute("href");
    if (changed.has(anchor) || href === null || !allowed(href)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  };
  inspect();
  const observer = new MutationObserver(inspect);
  observer.observe(root, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["href"],
  });
  for (const type of ["click", "auxclick", "keydown"])
    root.addEventListener(type, capture, true);
  return () => {
    observer.disconnect();
    for (const type of ["click", "auxclick", "keydown"])
      root.removeEventListener(type, capture, true);
    for (const [anchor, values] of changed)
      for (const [name, value] of values) {
        if (value === null) anchor.removeAttribute(name);
        else anchor.setAttribute(name, value);
      }
    changed.clear();
  };
}
