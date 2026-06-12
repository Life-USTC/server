import { fail } from "@sveltejs/kit";

export const adminBusFailure = (message: string, status = 400) =>
  fail(status, { message, variant: "destructive" as const });

export const adminBusSuccess = (message: string) => ({
  message,
  variant: "info" as const,
});

export function parseAdminBusVersionId(form: FormData) {
  const id = Number(form.get("id"));
  return Number.isInteger(id) ? id : null;
}
