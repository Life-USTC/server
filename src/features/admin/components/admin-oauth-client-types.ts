export type AdminOAuthCopy = Record<string, string> & {
  adminSubtitle: string;
  adminTitle: string;
  clientCount: string;
  clientGroupsLabel: string;
  clientPageStatus: string;
  createClient: string;
  nextPage: string;
  previousPage: string;
};

export type AdminOAuthAdminCopy = {
  title: string;
};

export type AdminOAuthCommonCopy = {
  home: string;
};

export type AdminOAuthClient = {
  clientId: string;
  createdAt: string | Date;
  disabled: boolean;
  name?: string | null;
  redirectUris: string[];
  scopes: string[];
  skipConsent: boolean | null;
  tokenEndpointAuthMethod: string;
};

export type AdminOAuthClientCopy = AdminOAuthCopy & {
  clientCount: string;
  clientGroupsLabel: string;
  clientPageStatus: string;
};
