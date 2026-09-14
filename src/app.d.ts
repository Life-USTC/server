import type { AppLocale } from "@/i18n/config";
import type { AppSession } from "@/lib/auth/session";

declare global {
  namespace App {
    interface PageState {
      adminAnalyticsPanel?: "feature" | "users" | "history";
      adminAuditTab?: "operations" | "runtime" | "audit";
    }

    interface Locals {
      authUser: AppSession["user"] | null;
      locale: AppLocale;
      publicSsr: boolean;
      requestId: string;
    }
  }
}
