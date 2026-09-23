export type StagedSocialVerifiedEmail = {
  provider: string;
  accountId: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  image: string | null;
};

const pendingSocialVerifiedEmails = new Map<
  string,
  StagedSocialVerifiedEmail
>();

function stagingKey(provider: string, accountId: string) {
  return `${provider}:${accountId}`;
}

export function stageSocialVerifiedEmail(input: StagedSocialVerifiedEmail) {
  pendingSocialVerifiedEmails.set(
    stagingKey(input.provider, input.accountId),
    input,
  );
}

export function consumeStagedSocialVerifiedEmail(
  provider: string,
  accountId: string,
): StagedSocialVerifiedEmail | null {
  const key = stagingKey(provider, accountId);
  const staged = pendingSocialVerifiedEmails.get(key) ?? null;
  pendingSocialVerifiedEmails.delete(key);
  return staged;
}

export function clearStagedSocialVerifiedEmails() {
  pendingSocialVerifiedEmails.clear();
}
