"use client";

import { useSearchParams } from "next/navigation";
import type * as React from "react";
import { Link, usePathname } from "@/i18n/routing";
import {
  buildCurrentPathCallbackUrl,
  buildSignInPageUrl,
} from "@/lib/auth/auth-routing";

type SignInLinkProps = Omit<React.ComponentProps<typeof Link>, "href"> & {
  callbackUrl?: string;
};

export function SignInLink({ callbackUrl, ...props }: SignInLinkProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const resolvedCallbackUrl =
    callbackUrl ?? buildCurrentPathCallbackUrl(pathname, searchParams);

  return <Link href={buildSignInPageUrl(resolvedCallbackUrl)} {...props} />;
}
