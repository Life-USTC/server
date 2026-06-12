import type { AppLocale } from "@/i18n/config";

declare global {
  namespace App {
    interface Locals {
      locale: AppLocale;
    }
  }
}
