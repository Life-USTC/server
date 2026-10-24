import {
  type DemoIdentity,
  type DemoView,
  DEMO_REFERENCE_NOW as REFERENCE_NOW,
} from "@/features/demo/lib/demo-types";
import { getWorkspacePageCopy } from "@/features/workspace/server/workspace-page-copy";
import type { AppLocale } from "@/i18n/config";
import type { WorkspaceNavigationSummary } from "@/lib/shell/shell-bootstrap";
import enUs from "../../../../messages/en-us.json";
import zhCn from "../../../../messages/zh-cn.json";
import {
  getDemoSubscribedSections,
  getDemoSubscriptionsTabData,
} from "./demo-subscriptions";
import { getDemoTodos } from "./demo-todos";

export function getDemoCopy(locale: AppLocale) {
  return (locale === "en-us" ? enUs : zhCn).demo;
}

export function getDemoView(
  identity: DemoIdentity,
  locale: AppLocale,
): DemoView {
  const copy = getDemoCopy(locale);
  return {
    ...identity,
    referenceNow: REFERENCE_NOW,
    displayName: copy.displayName,
    readOnlyReason: copy.readOnlyReason,
    exitLabel: copy.exit,
    unavailableReason: copy.unavailableReason,
    referenceTimeLabel: copy.referenceTime,
  };
}

export function getDemoNavigation(
  identity: DemoIdentity,
): WorkspaceNavigationSummary {
  return {
    userId: `demo:${identity.fixtureVersion}`,
    pendingTodosCount: getDemoTodos("zh-cn").filter((todo) => !todo.completed)
      .length,
    unreadActivityNotificationsCount: 0,
    calendarItemsCount: 0,
    examsCount: 0,
    pendingHomeworksCount: 0,
    subscribedSectionCount: getDemoSubscribedSections("zh-cn").length,
  };
}

export function getDemoWorkspacePage(
  identity: DemoIdentity,
  locale: AppLocale,
  tab: "todos" | "subscriptions",
) {
  const demo = getDemoView(identity, locale);
  const copy = getWorkspacePageCopy(locale);
  const { userId, subscribedSectionCount, ...counts } =
    getDemoNavigation(identity);
  return {
    copy,
    locale,
    demo,
    referenceNow: REFERENCE_NOW,
    signedIn: true,
    tab,
    mainContentLabel: copy.workspace.nav[tab].title,
    navStats: {
      ...counts,
      highlightPendingHomeworks: false,
      user: { id: userId, name: demo.displayName, username: null },
    },
    subscribedSectionCount,
    overview: null,
    links: null,
    homeworks: null,
    subscriptions:
      tab === "subscriptions"
        ? getDemoSubscriptionsTabData(identity, locale)
        : null,
    calendarSubscriptionUrl: null,
    todos: tab === "todos" ? getDemoTodos(locale) : null,
    bus: null,
  };
}
