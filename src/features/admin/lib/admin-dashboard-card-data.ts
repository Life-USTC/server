import type { Component } from "svelte";
import LayoutDashboard from "$lib/components/icons/layout-dashboard.svelte";
import Link2 from "$lib/components/icons/link-2.svelte";
import ShieldAlert from "$lib/components/icons/shield-alert.svelte";
import Users from "$lib/components/icons/users.svelte";

export type AdminDashboardCard = {
  description: string;
  href: string;
  icon: Component;
  label: string;
  meta: string;
  value: number | string;
};

export type AdminDashboardQueueCard = {
  href: string;
  label: string;
  meta: string;
  value: number | string;
};

export type AdminDashboardCardData = {
  copy: {
    busDescription: string;
    busTitle: string;
    dashboard: {
      active: string;
      activeComments: string;
      activeSuspensions: string;
      busImports: string;
      clientRegistration: string;
      comments: string;
      deleted: string;
      descriptionEdits: string;
      descriptions: string;
      homework: string;
      openItems: string;
      publishedRecords: string;
      queuesDescription: string;
      queuesTitle: string;
      view: string;
    };
    moderationDescription: string;
    moderationTitle: string;
    oauthDescription: string;
    oauthTitle: string;
    usersDescription: string;
    usersTitle: string;
    subtitle: string;
    title: string;
  };
  summary: {
    activeComments: number;
    busVersions: number;
    comments: number;
    deletedComments: number;
    homeworks: number;
    oauthClients: number;
    suspensions: number;
    users: number;
  };
};

export type AdminDashboardCopy = AdminDashboardCardData["copy"];

export type AdminDashboardCommonCopy = {
  home: string;
};

export function adminDashboardCards(
  data: AdminDashboardCardData,
): AdminDashboardCard[] {
  return [
    {
      href: "/admin/moderation",
      label: data.copy.moderationTitle,
      value: data.summary.comments,
      meta: `${data.summary.activeComments} ${data.copy.dashboard.active}, ${data.summary.deletedComments} ${data.copy.dashboard.deleted}`,
      description: data.copy.moderationDescription,
      icon: ShieldAlert,
    },
    {
      href: "/admin/users",
      label: data.copy.usersTitle,
      value: data.summary.users,
      meta: `${data.summary.suspensions} ${data.copy.dashboard.activeSuspensions}`,
      description: data.copy.usersDescription,
      icon: Users,
    },
    {
      href: "/admin/oauth",
      label: data.copy.oauthTitle,
      value: data.summary.oauthClients,
      meta: data.copy.dashboard.clientRegistration,
      description: data.copy.oauthDescription,
      icon: Link2,
    },
    {
      href: "/admin/bus",
      label: data.copy.busTitle,
      value: data.summary.busVersions,
      meta: data.copy.dashboard.busImports,
      description: data.copy.busDescription,
      icon: LayoutDashboard,
    },
  ];
}

export function adminDashboardQueueCards(
  data: AdminDashboardCardData,
): AdminDashboardQueueCard[] {
  return [
    {
      href: "/admin/moderation?tab=comments",
      label: data.copy.dashboard.comments,
      value: data.summary.activeComments,
      meta: data.copy.dashboard.activeComments,
    },
    {
      href: "/admin/moderation?tab=descriptions",
      label: data.copy.dashboard.descriptions,
      value: data.copy.dashboard.view,
      meta: data.copy.dashboard.descriptionEdits,
    },
    {
      href: "/admin/moderation?tab=homeworks",
      label: data.copy.dashboard.homework,
      value: data.summary.homeworks,
      meta: data.copy.dashboard.publishedRecords,
    },
  ];
}
