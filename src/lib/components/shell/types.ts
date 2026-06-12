export type ShellLink = {
  href: string;
  label: string;
  rel?: string;
  target?: "_blank";
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
    menu: string;
    primaryNavigation: string;
    profileMenu: string;
  };
};

export type ShellUser = {
  image?: string | null;
  name?: string | null;
} | null;
