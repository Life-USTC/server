export function createAdminUsersControllerDefaultState<User>(input: {
  users: User[];
}) {
  return {
    editIsAdmin: false,
    editName: "",
    editUsername: "",
    isLiftingSuspension: false,
    isSaving: false,
    isSuspending: false,
    message: null as string | null,
    selectedUser: null as User | null,
    suspendDuration: "3d",
    suspendExpiresAt: "",
    suspendReason: "",
    users: input.users,
  };
}
