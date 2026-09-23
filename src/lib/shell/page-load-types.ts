import type { AppLocale } from "@/i18n/config";

/** Shared SvelteKit load event shape used by shell/public pages. */
export type AppPageLoadEvent = {
  locals: {
    locale: AppLocale;
    requestId?: string;
  };
  request: Request;
  url: URL;
};
