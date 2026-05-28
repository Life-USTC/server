"use client";

import { User as UserIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { signOutCurrentUser } from "@/app/actions/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "@/components/ui/menu";
import { Link } from "@/i18n/routing";
import { cn } from "@/lib/utils";

type UserMenuProps = {
  className?: string;
  initialUser?: {
    id: string;
    name: string | null;
    image: string | null;
    username: string | null;
  } | null;
};

export function UserMenu({ className, initialUser = null }: UserMenuProps) {
  const router = useRouter();
  const tProfile = useTranslations("profile");
  const tSettings = useTranslations("settings");
  const tCommon = useTranslations("common");
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isSignedOut, setIsSignedOut] = useState(false);
  const user = initialUser;

  if (!user || isSignedOut) {
    return null;
  }

  const menuLabel = tProfile("title");
  const avatarFallback = user.name?.charAt(0) ?? menuLabel.charAt(0);
  const profileHref = user.username
    ? `/u/${user.username}`
    : user.id
      ? `/u/id/${user.id}`
      : "/";

  const handleSignOut = async () => {
    if (isSigningOut) return;

    setIsSigningOut(true);
    const result = await signOutCurrentUser();
    if (result.error) {
      setIsSigningOut(false);
      return;
    }

    setIsSignedOut(true);
    router.push("/");
    router.refresh();
  };

  return (
    <div className={cn("flex items-center", className)}>
      <Menu>
        <MenuTrigger
          render={
            <Button
              aria-label={menuLabel}
              className="h-9 w-9"
              size="icon"
              variant="outline"
            >
              {user.image ? (
                <Avatar className="h-6 w-6">
                  <AvatarImage src={user.image} alt={user.name || menuLabel} />
                  <AvatarFallback>{avatarFallback}</AvatarFallback>
                </Avatar>
              ) : (
                <UserIcon className="h-5 w-5" />
              )}
            </Button>
          }
        />
        <MenuPopup>
          <MenuItem render={<Link className="no-underline" href="/" />}>
            {tCommon("home")}
          </MenuItem>
          <MenuItem
            render={<Link className="no-underline" href={profileHref} />}
          >
            {tCommon("me")}
          </MenuItem>
          <MenuItem
            render={
              <Link className="no-underline" href="/settings?tab=profile" />
            }
          >
            {tSettings("title")}
          </MenuItem>
          <MenuItem disabled={isSigningOut} onClick={handleSignOut}>
            {tProfile("signOut")}
          </MenuItem>
        </MenuPopup>
      </Menu>
    </div>
  );
}
