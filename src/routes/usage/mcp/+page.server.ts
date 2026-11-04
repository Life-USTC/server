import type { AppLocale } from "@/i18n/config";
import enUsMessages from "../../../../messages/en-us.json";
import zhCnMessages from "../../../../messages/zh-cn.json";
import type { PageServerLoad } from "./$types";

const messages = {
  "zh-cn": zhCnMessages,
  "en-us": enUsMessages,
} satisfies Record<AppLocale, typeof enUsMessages>;

export const load: PageServerLoad = ({ locals, url }) => {
  const copy = messages[locals.locale];
  const requestedClient = url.searchParams.get("client");
  const client: "chatgpt" | "claude" | "other" =
    requestedClient === "claude" || requestedClient === "other"
      ? requestedClient
      : "chatgpt";
  return {
    client,
    copy: copy.usagePages.mcp,
    metadataTitle: copy.metadata.pages.mcp,
  };
};
