"use client";

import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { createOAuthClient, deleteOAuthClient } from "@/app/actions/oauth";
import { useToast } from "@/hooks/use-toast";
import { createShanghaiDateTimeFormatter } from "@/lib/time/shanghai-format";
import { OAuthClientCreateDialog } from "./oauth-client-create-dialog";
import { CreatedCredentialsCard, OAuthClientList } from "./oauth-client-list";
import {
  type CreatedCredentials,
  DEFAULT_AUTH_METHOD,
  DEFAULT_SCOPE_VALUES,
  isPublicClientAuthMethod,
  isTrustedClientAuthMethod,
  type OAuthClientInfo,
  parseRedirectUris,
} from "./oauth-client-manager-shared";
import { OAuthClientOverview } from "./oauth-client-overview";

export function OAuthClientManager({
  clients,
}: {
  clients: OAuthClientInfo[];
}) {
  const locale = useLocale();
  const t = useTranslations("oauth");
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [selectedAuthMethod, setSelectedAuthMethod] =
    useState<string>(DEFAULT_AUTH_METHOD);
  const [selectedScopes, setSelectedScopes] =
    useState<string[]>(DEFAULT_SCOPE_VALUES);
  const [redirectDraft, setRedirectDraft] = useState("");
  const [createdCredentials, setCreatedCredentials] =
    useState<CreatedCredentials | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const trustedClients = useMemo(
    () => clients.filter((client) => client.isTrusted),
    [clients],
  );
  const publicClients = useMemo(
    () =>
      clients.filter((client) =>
        isPublicClientAuthMethod(client.tokenEndpointAuthMethod),
      ),
    [clients],
  );
  const externalClients = useMemo(
    () => clients.filter((client) => !client.isTrusted),
    [clients],
  );
  const dateTimeFormatter = useMemo(
    () =>
      createShanghaiDateTimeFormatter(locale, {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    [locale],
  );

  async function copyValue(value: string, description: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast({
        title: t("copySuccess"),
        description,
        variant: "success",
      });
    } catch {
      toast({
        title: t("copyError"),
        description: t("copyErrorDescription"),
        variant: "destructive",
      });
    }
  }

  function openCreateDialog(nextMethod = DEFAULT_AUTH_METHOD) {
    setSelectedAuthMethod(nextMethod);
    setCreateDialogOpen(true);
  }

  async function onCreateClient(formData: FormData) {
    const name = String(formData.get("name") ?? "").trim();
    const redirectUris = parseRedirectUris(
      String(formData.get("redirectUris") ?? ""),
    );
    const tokenEndpointAuthMethod =
      String(formData.get("tokenEndpointAuthMethod") ?? DEFAULT_AUTH_METHOD) ||
      DEFAULT_AUTH_METHOD;
    const scopes = formData
      .getAll("scopes")
      .map((value) => String(value).trim())
      .filter(Boolean);
    const isTrusted = isTrustedClientAuthMethod(tokenEndpointAuthMethod);

    setLoading(true);
    const result = await createOAuthClient(formData);
    setLoading(false);

    if ("error" in result) {
      toast({
        title: t("createError"),
        description: result.error,
        variant: "destructive",
      });
      return;
    }

    setCreatedCredentials({
      clientId: result.clientId,
      clientSecret:
        typeof result.clientSecret === "string" ? result.clientSecret : null,
      name,
      tokenEndpointAuthMethod,
      redirectUris,
      scopes,
      isTrusted,
    });
    setSelectedAuthMethod(DEFAULT_AUTH_METHOD);
    setSelectedScopes([...DEFAULT_SCOPE_VALUES]);
    setRedirectDraft("");
    setFormKey((current) => current + 1);
    setCreateDialogOpen(false);
    toast({
      title: t("createSuccess"),
      description: t("createSuccessDescription"),
      variant: "success",
    });
  }

  async function onDeleteClient(clientId: string) {
    const result = await deleteOAuthClient(clientId);
    if (result.error) {
      toast({
        title: t("deleteError"),
        description: result.error,
        variant: "destructive",
      });
    } else {
      toast({
        title: t("deleteSuccess"),
        variant: "success",
      });
    }
  }

  function toggleScope(scope: string, nextChecked: boolean) {
    setSelectedScopes((current) => {
      if (nextChecked) {
        return current.includes(scope) ? current : [...current, scope];
      }
      return current.filter((value) => value !== scope);
    });
  }

  return (
    <div className="space-y-6">
      <OAuthClientOverview
        clientCount={clients.length}
        trustedCount={trustedClients.length}
        publicCount={publicClients.length}
        onOpenCreateDialog={openCreateDialog}
        t={t}
      />

      {createdCredentials ? (
        <CreatedCredentialsCard
          createdCredentials={createdCredentials}
          copyValue={copyValue}
          onDismiss={() => setCreatedCredentials(null)}
          t={t}
        />
      ) : null}

      <OAuthClientCreateDialog
        createDialogOpen={createDialogOpen}
        formKey={formKey}
        loading={loading}
        onCreateClient={onCreateClient}
        redirectDraft={redirectDraft}
        selectedAuthMethod={selectedAuthMethod}
        selectedScopes={selectedScopes}
        setCreateDialogOpen={setCreateDialogOpen}
        setRedirectDraft={setRedirectDraft}
        setSelectedAuthMethod={setSelectedAuthMethod}
        toggleScope={toggleScope}
        t={t}
      />

      <OAuthClientList
        clients={clients}
        trustedClients={trustedClients}
        externalClients={externalClients}
        copyValue={copyValue}
        dateTimeFormatter={dateTimeFormatter}
        onDeleteClient={onDeleteClient}
        t={t}
      />
    </div>
  );
}
