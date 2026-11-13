<script lang="ts">
import FilesIcon from "@lucide/svelte/icons/files";
import LogOutIcon from "@lucide/svelte/icons/log-out";
import SettingsIcon from "@lucide/svelte/icons/settings";
import UserRoundIcon from "@lucide/svelte/icons/user-round";
import WrenchIcon from "@lucide/svelte/icons/wrench";
import * as Avatar from "#lib/components/ui/avatar/index.js";
import { Button } from "#lib/components/ui/button/index.js";
import * as DropdownMenu from "#lib/components/ui/dropdown-menu/index.js";
import type {
  LayoutCopy,
  LayoutUserSummary,
} from "#lib/shell/layout-server-data.js";
import type { DemoView } from "@/features/demo/lib/demo-types";

export let avatarFallback: string;
export let closeMenus: () => void;
export let copy: LayoutCopy;
export let currentPathname: string;
export let profileHref: string;
export let setUserMenuOpen: (open: boolean) => void;
export let user: LayoutUserSummary;
export let userMenuOpen: boolean;

export let demo: DemoView | null = null;
function closeAccountNavigation() {
  closeMenus();
}
</script>

{#if user || demo}
  <div id={demo ? "demo-navigation-menu" : "app-user-menu"}>
    <DropdownMenu.Root open={userMenuOpen} onOpenChange={setUserMenuOpen}>
      <DropdownMenu.Trigger>
        {#snippet child({ props })}
          <Button
            {...props}
            variant="ghost"
            size="icon"
            class="size-11 shrink-0 rounded-full"
            aria-label={demo?.displayName ?? copy.shell.profileMenu}
            title={user?.name ?? demo?.displayName ?? copy.shell.profileMenu}
          >
            <Avatar.Root class="size-8 rounded-full">
              {#if user?.image}<Avatar.Image src={user.image} alt="" />{/if}
              <Avatar.Fallback>{demo ? "D" : avatarFallback}</Avatar.Fallback>
            </Avatar.Root>
          </Button>
        {/snippet}
      </DropdownMenu.Trigger>
      <DropdownMenu.Content
        align="end"
        class="w-56"
        preventScroll={false}
        side="bottom"
      >
        <DropdownMenu.Group>
          <DropdownMenu.Label class="grid min-w-0"
            ><span class="truncate"
              >{user?.name ?? demo?.displayName ?? copy.menu.me}</span
            >{#if user?.username}<span
                class="truncate text-muted-foreground text-xs"
                >@{user.username}</span
              >{/if}</DropdownMenu.Label
          >
          {#if user}
            <DropdownMenu.Item onSelect={closeAccountNavigation}>
              {#snippet child({ props })}
                <a
                  {...props}
                  aria-current={currentPathname === profileHref
                    ? "page"
                    : undefined}
                  href={profileHref}
                >
                  <UserRoundIcon />
                  {copy.menu.personalPage}
                </a>
              {/snippet}
            </DropdownMenu.Item>
          {/if}
          <DropdownMenu.Item onSelect={closeAccountNavigation}>
            {#snippet child({ props })}
              <a
                {...props}
                aria-current={currentPathname ===
                (demo
                  ? "/account/settings/profile"
                  : "/account/settings/preferences")
                  ? "page"
                  : undefined}
                href={demo
                  ? "/account/settings/profile"
                  : "/account/settings/preferences"}
              >
                <SettingsIcon />
                {copy.menu.settings}
              </a>
            {/snippet}
          </DropdownMenu.Item>
          {#if user}
            <DropdownMenu.Item onSelect={closeAccountNavigation}
              >{#snippet child({ props })}<a
                  {...props}
                  href="/workspace/uploads"><FilesIcon />{copy.nav.uploads}</a
                >{/snippet}</DropdownMenu.Item
            >
            {#if user.isAdmin}<DropdownMenu.Item
                onSelect={closeAccountNavigation}
                >{#snippet child({ props })}<a {...props} href="/admin/users"
                    ><WrenchIcon />{copy.nav.admin.title}</a
                  >{/snippet}</DropdownMenu.Item
              >{/if}
            <form method="POST" action="/account/sign-out">
              <DropdownMenu.Item>
                {#snippet child({ props })}
                  <button {...props} type="submit">
                    <LogOutIcon />
                    {copy.menu.signOut}
                  </button>
                {/snippet}
              </DropdownMenu.Item>
            </form>
          {/if}
        </DropdownMenu.Group>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  </div>
{/if}
