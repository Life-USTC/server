/** Existing public information reads only; this does not grant server authority. */
export const DEMO_INFORMATION_PAGE_PATHS = [
  "/terms",
  "/privacy",
  "/guides/markdown-support",
  "/usage/mobile",
  "/usage/bot",
  "/usage/cli",
  "/usage/mcp",
  "/community/comments/guide",
] as const;

const imagePaths = [
  "/images/appstore.svg",
  "/images/icon.png",
  "/images/mobile-app/app-icon.png",
  "/images/mobile-app/iphone-16-pro-max-bezel.png",
  "/images/mobile-app/screenshot-01.png",
  "/images/mobile-app/screenshot-02.png",
  "/images/mobile-app/screenshot-03.png",
  "/images/mobile-app/screenshot-04.png",
  "/images/usage/mcp-chatgpt-filled-en.png",
  "/images/usage/mcp-chatgpt-filled-zh.png",
  "/images/usage/mcp-chatgpt-icon.png",
  "/images/usage/mcp-chatgpt-overview-en.png",
  "/images/usage/mcp-chatgpt-overview-zh.png",
  "/images/usage/mcp-claude-empty.png",
  "/images/usage/mcp-claude-filled.png",
  "/images/usage/mcp-use-case.png",
  "/images/usage/presto-bus.png",
  "/images/usage/presto-homework.png",
  "/images/usage/presto-next-class.png",
  "/images/usage/presto-schedule.png",
] as const;

export function isDemoInformationReadPathname(pathname: string) {
  const pagePath = pathname.endsWith("/__data.json")
    ? pathname.slice(0, -"/__data.json".length)
    : pathname;
  return DEMO_INFORMATION_PAGE_PATHS.some((path) => path === pagePath);
}

export function isDemoInformationDestination(url: URL, origin: string) {
  if (url.origin !== origin || url.username || url.password) return false;
  return (
    DEMO_INFORMATION_PAGE_PATHS.some((path) => path === url.pathname) ||
    (imagePaths.some((path) => path === url.pathname) &&
      (url.search === "" || /^\?retry=\d+$/.test(url.search)))
  );
}
