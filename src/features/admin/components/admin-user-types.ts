export type AdminUserRow = {
  activeSuspension?: {
    expiresAt?: string | null;
    id?: string;
  } | null;
  createdAt: Date | string;
  email?: string | null;
  id: string;
  isAdmin: boolean;
  name?: string | null;
  username?: string | null;
};

export type AdminUsersCopy = {
  adminToggleLabel: string;
  adminRole: string;
  allUsers: string;
  clearStatus: string;
  createdAt: string;
  currentFilter: string;
  editTitle: string;
  email: string;
  findAccounts: string;
  findAccountsDescription: string;
  liftSuspensionAction: string;
  lifting: string;
  name: string;
  nameLabel: string;
  noUsername: string;
  noVerifiedEmail: string;
  profileRoleDescription: string;
  profileRoleTitle: string;
  role: string;
  saveAction: string;
  saving: string;
  searchPlaceholder: string;
  subtitle: string;
  suspendDescription: string;
  suspendTitle: string;
  suspending: string;
  suspendedStatus: string;
  suspension: string;
  title: string;
  userRole: string;
  username: string;
  usernameLabel: string;
};

export type AdminUserFormatter = (user: AdminUserRow) => string;

export type AdminUsersPagination = {
  page: number;
  total: number;
  totalPages: number;
};

export type AdminUsersAdminCopy = {
  title: string;
};

export type AdminUsersCommonCopy = {
  clear: string;
  home: string;
  next: string;
  nextPage: string;
  pagination: string;
  previous: string;
  previousPage: string;
  search: string;
};

export type AdminUsersModerationCopy = {
  cancelButton: string;
  duration1Day: string;
  duration3Days: string;
  duration1Month: string;
  duration1Week: string;
  durationPermanent: string;
  durationLabel: string;
  reason: string;
  durationCustom: string;
  permanent: string;
  suspendAction: string;
  suspendExpires: string;
  suspendReason: string;
};

export type AdminUsersFilters = {
  search?: string | null;
};

export type AdminUsersPageCopy = AdminUsersCopy & {
  accountsDescription: string;
  accountsTitle: string;
  liftFailed: string;
  liftSuccess: string;
  noResults: string;
  showing: string;
  suspendFailed: string;
  suspendSuccess: string;
  until: string;
  updateFailed: string;
  updateSuccess: string;
};

export type AdminUsersPageHref = (page: number) => string;
