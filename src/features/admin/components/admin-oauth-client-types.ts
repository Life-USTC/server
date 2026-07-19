export type AdminOAuthCopy = Record<string, string> & {
  adminSubtitle: string;
  adminTitle: string;
  clientCount: string;
  createClient: string;
};

export type AdminOAuthAdminCopy = {
  title: string;
};

export type AdminOAuthClient = {
  clientId: string;
  createdAt: string | Date;
  disabled: boolean;
  name?: string | null;
  scopes: string[];
  skipConsent: boolean | null;
  tokenEndpointAuthMethod: string;
};
