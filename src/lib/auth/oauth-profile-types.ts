export type OAuthProfile = Record<string, unknown>;

export type GithubProfile = {
  email?: string | null;
  id: string;
  name?: string;
  login?: string;
  avatar_url?: string;
};

export type GoogleProfile = {
  email?: string;
  sub: string;
  name?: string;
  picture?: string;
  email_verified?: boolean;
};
