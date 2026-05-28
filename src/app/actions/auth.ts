"use server";

import { revalidatePath } from "next/cache";
import { signOut } from "@/auth";
import { logServerActionError } from "@/lib/log/app-logger";

export async function signOutCurrentUser() {
  try {
    await signOut({ redirect: false });
    revalidatePath("/");

    return { success: true };
  } catch (error) {
    logServerActionError("Failed to sign out", error, {
      action: "signOutCurrentUser",
    });
    return { error: "Failed to sign out" };
  }
}
