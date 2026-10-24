import type { TableFilterField } from "@/lib/table-filters";
import type { AdminUsersCopy } from "../components/admin-user-types";

export function adminUserTableFields(copy: AdminUsersCopy): TableFilterField[] {
  return [
    { name: "name", label: copy.name },
    { name: "username", label: copy.username },
    { name: "email", label: copy.email },
    {
      name: "role",
      label: copy.role,
      options: [
        { value: "admin", label: copy.adminRole },
        { value: "user", label: copy.userRole },
      ],
    },
    {
      name: "suspension",
      label: copy.suspension,
      options: [
        { value: "suspended", label: copy.suspendedStatus },
        { value: "clear", label: copy.clearStatus },
      ],
    },
    { name: "createdAt", label: copy.createdAt, type: "date" },
  ];
}
