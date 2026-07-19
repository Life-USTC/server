import type { Component } from "svelte";

export type ShellLink = {
  ariaLabel?: string;
  badge?: number | null;
  href: string;
  icon?: Component;
  items?: ShellLink[];
  label: string;
  rel?: string;
  target?: "_blank";
};

export type ShellNavGroup = {
  defaultOpen?: boolean;
  label: string;
  links: ShellLink[];
};

export type ShellCopy = {
  language: {
    chinese: string;
    english: string;
    selector: string;
  };
  menu: {
    home: string;
    me: string;
    settings: string;
    signIn: string;
    signOut: string;
  };
  shell: {
    footerNavigation: string;
    menu: string;
    mobilePrimaryNavigation: string;
    primaryNavigation: string;
    profileMenu: string;
    secondaryNavigation: string;
  };
};

export type ShellUser = {
  image?: string | null;
  name?: string | null;
  username?: string | null;
} | null;
