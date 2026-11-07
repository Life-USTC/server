import {
  DEMO_REFERENCE_NOW,
  type DemoIdentity,
} from "@/features/demo/lib/demo-types";
import type { AppLocale } from "@/i18n/config";
import { getDemoView } from "./demo-workspace";

/** Fixed presentation facts, never a database user or authentication principal. */
export function getDemoAccountProfile(
  identity: DemoIdentity,
  locale: AppLocale,
) {
  return {
    id: `demo:${identity.fixtureVersion}`,
    email: "demo@example.test",
    username: "demo-student",
    name: getDemoView(identity, locale).displayName,
    image: null,
    isAdmin: false,
    createdAt: new Date(DEMO_REFERENCE_NOW),
    updatedAt: new Date(DEMO_REFERENCE_NOW),
  };
}
