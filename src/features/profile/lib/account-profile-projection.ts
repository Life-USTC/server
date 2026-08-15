export type AuthenticatedAccountProfile = {
  id: string;
  email: string;
  username: string | null;
  name: string;
  image: string | null;
  isAdmin: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export function projectAuthenticatedUserProfile(
  profile: AuthenticatedAccountProfile,
  visibility: { email: boolean; adminStatus: boolean },
) {
  return {
    ...profile,
    email: visibility.email ? profile.email : null,
    isAdmin: visibility.adminStatus ? profile.isAdmin : null,
  };
}
