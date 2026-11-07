import type { Component } from "svelte";

export type ShellGlyph =
  | "profile"
  | "preferences"
  | "accounts"
  | "key"
  | "danger";

export type ShellLink = {
  /** Static destination identity, independent of locale and viewer records. */
  id?: string;
  disabledReason?: string;
  ariaLabel?: string;
  badge?: number | null;
  /** Readable, non-modal explanation of a destination or its existing count. */
  discoveryHint?: { text: string; label: string; description: string };
  glyph?: ShellGlyph;
  href: string;
  icon?: Component;
  items?: ShellLink[];
  label: string;
  rel?: string;
  target?: "_blank";
};

export type ShellNavGroup = {
  id?: string;
  defaultOpen?: boolean;
  icon?: Component;
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
    personalPage: string;
    settings: string;
    signIn: string;
    signOut: string;
  };
  shell: {
    footerNavigation: string;
    menu: string;
    primaryNavigation: string;
    profileMenu: string;
  };
};

export type ShellUser = {
  image?: string | null;
  name?: string | null;
  username?: string | null;
} | null;
