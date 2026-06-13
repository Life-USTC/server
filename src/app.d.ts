import type { AppLocale } from "@/i18n/config";
import type { AppSession } from "@/lib/auth/session";

declare global {
  namespace App {
    interface Locals {
      authUser: AppSession["user"] | null;
      locale: AppLocale;
      requestId: string;
    }
  }
}
