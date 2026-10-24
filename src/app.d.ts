import type { DemoIdentity } from "@/features/demo/lib/demo-types";
import type { AppLocale } from "@/i18n/config";
import type { AppSession } from "@/lib/auth/session";

declare global {
  namespace App {
    interface Locals {
      authUser: AppSession["user"] | null;
      demo?: DemoIdentity | null;
      locale: AppLocale;
      publicSsr: boolean;
      requestId: string;
    }
  }
}
