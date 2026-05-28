"use client";

import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AuthMethodLeadIcon,
  type OAuthTranslator,
} from "./oauth-client-manager-shared";

export function OAuthClientOverview({
  clientCount,
  trustedCount,
  publicCount,
  onOpenCreateDialog,
  t,
}: {
  clientCount: number;
  trustedCount: number;
  publicCount: number;
  onOpenCreateDialog: (method?: string) => void;
  t: OAuthTranslator;
}) {
  return (
    <section className="border-border/70 border-y py-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex max-w-full items-center gap-2 text-muted-foreground text-xs uppercase tracking-[0.14em]">
            <ShieldCheck className="size-3.5" />
            <span className="min-w-0 truncate" translate="no">
              Better Auth OAuth Provider
            </span>
          </div>
          <div className="space-y-1.5">
            <h2 className="font-heading font-semibold text-lg tracking-tight">
              {t("panelGuideTitle")}
            </h2>
            <p className="max-w-3xl text-muted-foreground text-sm leading-6">
              {t("panelGuideDescription")}
            </p>
          </div>
          <p className="text-muted-foreground text-xs tabular-nums">
            {t("overviewClients")}: {clientCount} · {t("overviewTrusted")}:{" "}
            {trustedCount} · {t("overviewPublic")}: {publicCount}
          </p>
        </div>

        <Button
          type="button"
          className="w-full lg:w-auto"
          onClick={() => onOpenCreateDialog()}
        >
          <AuthMethodLeadIcon className="size-4.5" />
          {t("createClient")}
        </Button>
      </div>
    </section>
  );
}
