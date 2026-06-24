const PROFILE_USERNAME_CHAR_CLASS = "[a-z0-9-]";

export const PROFILE_USERNAME_PATTERN = `${PROFILE_USERNAME_CHAR_CLASS}+`;
export const PROFILE_USERNAME_MAX_LENGTH = 20;

const PROFILE_USERNAME_REGEXP = new RegExp(
  `^${PROFILE_USERNAME_CHAR_CLASS}{1,${PROFILE_USERNAME_MAX_LENGTH}}$`,
);
const RESERVED_PROFILE_USERNAMES = new Set(["id"]);

export function isValidProfileUsername(username: string) {
  return (
    PROFILE_USERNAME_REGEXP.test(username) &&
    !RESERVED_PROFILE_USERNAMES.has(username)
  );
}
