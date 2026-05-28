"use client";

import { ChevronLeft, ChevronRight, Copy } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  type CreatedCredentials,
  getClientTypeBadgeVariant,
  getClientTypeLabel,
  type OAuthClientInfo,
  type OAuthTranslator,
} from "./oauth-client-manager-shared";

const CLIENTS_PER_SECTION_PAGE = 3;

function CopyField({
  label,
  value,
  copyLabel,
  onCopy,
  disabled = false,
}: {
  label: string;
  value: string;
  copyLabel: string;
  onCopy: () => void;
  disabled?: boolean;
}) {
  return (
    <Field className="space-y-2">
      <FieldLabel>{label}</FieldLabel>
      <div className="flex min-w-0 flex-col items-stretch gap-2 sm:flex-row">
        <Button
          type="button"
          className="min-w-0 flex-1 justify-start overflow-hidden font-mono text-sm"
          onClick={onCopy}
          disabled={disabled}
          variant="outline"
        >
          <span className="min-w-0 truncate" translate="no">
            {value}
          </span>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full sm:w-auto"
          onClick={onCopy}
          disabled={disabled}
        >
          <Copy className="size-4" />
          {copyLabel}
        </Button>
      </div>
    </Field>
  );
}

function OAuthClientCard({
  client,
  copyValue,
  dateTimeFormatter,
  onDeleteClient,
  t,
}: {
  client: OAuthClientInfo;
  copyValue: (value: string, description: string) => Promise<void>;
  dateTimeFormatter: Intl.DateTimeFormat;
  onDeleteClient: (clientId: string) => Promise<void>;
  t: OAuthTranslator;
}) {
  const redirectUris = client.redirectUris.slice(0, 2);
  const hasMoreRedirectUris = client.redirectUris.length > redirectUris.length;

  return (
    <article className="min-w-0 border-border/70 border-b py-4 last:border-b-0">
      <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(12rem,0.9fr)_minmax(0,1.35fr)_auto] lg:items-start">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="min-w-0 font-semibold text-sm leading-6">
              {client.name.trim().length > 0 ? (
                client.name
              ) : (
                <span className="text-muted-foreground italic">
                  {t("unnamedClient")}
                </span>
              )}
            </p>
            <Badge variant="outline">
              {getClientTypeLabel(t, client.tokenEndpointAuthMethod)}
            </Badge>
            {client.isTrusted ? (
              <Badge variant="outline">{t("clientTrustTrusted")}</Badge>
            ) : null}
          </div>
          <p className="text-muted-foreground text-xs tabular-nums">
            {dateTimeFormatter.format(new Date(client.createdAt))}
          </p>
        </div>

        <div className="min-w-0 space-y-2 text-sm">
          <div className="flex min-w-0 items-center gap-2">
            <span className="shrink-0 text-muted-foreground text-xs">
              {t("clientIdLabel")}
            </span>
            <span
              className="min-w-0 flex-1 truncate font-mono text-xs"
              title={client.clientId}
              translate="no"
            >
              {client.clientId}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={t("copyClientId")}
              onClick={() => copyValue(client.clientId, t("clientIdCopied"))}
            >
              <Copy className="size-4" />
            </Button>
          </div>

          <div className="min-w-0 space-y-1">
            <p className="text-muted-foreground text-xs">
              {t("tableColumnRedirects")}
            </p>
            {redirectUris.length === 0 ? (
              <p className="text-muted-foreground text-sm">—</p>
            ) : (
              <div className="space-y-1">
                {redirectUris.map((redirectUri) => (
                  <div key={redirectUri} className="flex items-start gap-2">
                    <span
                      className="min-w-0 flex-1 break-all font-mono text-xs"
                      translate="no"
                    >
                      {redirectUri}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("copyRedirectUri")}
                      onClick={() =>
                        copyValue(redirectUri, t("redirectUriCopied"))
                      }
                    >
                      <Copy className="size-4" />
                    </Button>
                  </div>
                ))}
                {hasMoreRedirectUris ? (
                  <p className="text-muted-foreground text-xs">
                    {t("previewRedirectCount", {
                      count: client.redirectUris.length,
                    })}
                  </p>
                ) : null}
              </div>
            )}
          </div>

          <p className="text-muted-foreground text-xs">
            {client.scopes
              .map((scope) => t(`scope_${scope}`, { fallback: scope }))
              .join(" · ")}
          </p>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="justify-self-start text-destructive hover:text-destructive lg:justify-self-end"
          onClick={() => onDeleteClient(client.clientId)}
        >
          {t("deleteClient")}
        </Button>
      </div>
    </article>
  );
}

function OAuthClientSection({
  clients,
  copyValue,
  dateTimeFormatter,
  emptyKey,
  onDeleteClient,
  title,
  description,
  t,
}: {
  clients: OAuthClientInfo[];
  copyValue: (value: string, description: string) => Promise<void>;
  dateTimeFormatter: Intl.DateTimeFormat;
  emptyKey: string;
  onDeleteClient: (clientId: string) => Promise<void>;
  title: string;
  description: string;
  t: OAuthTranslator;
}) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(
    1,
    Math.ceil(clients.length / CLIENTS_PER_SECTION_PAGE),
  );
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * CLIENTS_PER_SECTION_PAGE;
  const visibleClients = clients.slice(
    startIndex,
    startIndex + CLIENTS_PER_SECTION_PAGE,
  );
  const showingStart = clients.length === 0 ? 0 : startIndex + 1;
  const showingEnd = Math.min(
    startIndex + visibleClients.length,
    clients.length,
  );

  return (
    <section className="min-w-0 border-border/70 border-y">
      <header className="border-border/70 border-b py-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-semibold text-base leading-6">{title}</h2>
          <Badge variant="outline" className="tabular-nums">
            {clients.length}
          </Badge>
        </div>
        <p className="mt-1 text-muted-foreground text-sm leading-6">
          {description}
        </p>
      </header>
      <div>
        {clients.length === 0 ? (
          <div className="border-border/70 border-b border-dashed py-6 text-muted-foreground text-sm">
            {t(emptyKey)}
          </div>
        ) : (
          <>
            <div>
              {visibleClients.map((client) => (
                <OAuthClientCard
                  key={client.clientId}
                  client={client}
                  copyValue={copyValue}
                  dateTimeFormatter={dateTimeFormatter}
                  onDeleteClient={onDeleteClient}
                  t={t}
                />
              ))}
            </div>
            {totalPages > 1 ? (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-3">
                <p className="text-muted-foreground text-xs tabular-nums">
                  {t("clientPageStatus", {
                    start: showingStart,
                    end: showingEnd,
                    total: clients.length,
                  })}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((value) => Math.max(1, value - 1))}
                    disabled={currentPage <= 1}
                  >
                    <ChevronLeft className="size-4" />
                    {t("previousPage")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setPage((value) => Math.min(totalPages, value + 1))
                    }
                    disabled={currentPage >= totalPages}
                  >
                    {t("nextPage")}
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

export function CreatedCredentialsCard({
  createdCredentials,
  copyValue,
  onDismiss,
  t,
}: {
  createdCredentials: CreatedCredentials;
  copyValue: (value: string, description: string) => Promise<void>;
  onDismiss: () => void;
  t: OAuthTranslator;
}) {
  return (
    <Card className="min-w-0 border-success">
      <CardHeader>
        <CardTitle>{t("credentialsTitle")}</CardTitle>
        <CardDescription>{t("credentialsWarning")}</CardDescription>
      </CardHeader>
      <CardPanel className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant={getClientTypeBadgeVariant(
              createdCredentials.tokenEndpointAuthMethod,
            )}
          >
            {getClientTypeLabel(t, createdCredentials.tokenEndpointAuthMethod)}
          </Badge>
          {createdCredentials.scopes.map((scope) => (
            <Badge key={scope} variant="outline">
              <span translate="no">
                {t(`scope_${scope}`, { fallback: scope })}
              </span>
            </Badge>
          ))}
          {createdCredentials.isTrusted ? (
            <Badge variant="outline">{t("clientTrustTrusted")}</Badge>
          ) : null}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <CopyField
            label={t("clientIdLabel")}
            value={createdCredentials.clientId}
            copyLabel={t("copyClientId")}
            onCopy={() =>
              copyValue(createdCredentials.clientId, t("clientIdCopied"))
            }
          />

          <CopyField
            label={t("clientSecretLabel")}
            value={createdCredentials.clientSecret ?? t("publicClientNoSecret")}
            copyLabel={t("copyClientSecret")}
            disabled={!createdCredentials.clientSecret}
            onCopy={() => {
              if (!createdCredentials.clientSecret) return;
              void copyValue(
                createdCredentials.clientSecret,
                t("clientSecretCopied"),
              );
            }}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              copyValue(
                JSON.stringify(
                  {
                    client_id: createdCredentials.clientId,
                    client_secret: createdCredentials.clientSecret,
                    redirect_uris: createdCredentials.redirectUris,
                    token_endpoint_auth_method:
                      createdCredentials.tokenEndpointAuthMethod,
                    scopes: createdCredentials.scopes,
                  },
                  null,
                  2,
                ),
                t("credentialsCopied"),
              )
            }
          >
            <Copy className="size-4" />
            {t("copyCredentials")}
          </Button>
          <Button type="button" variant="ghost" onClick={onDismiss}>
            {t("dismissCredentials")}
          </Button>
        </div>
      </CardPanel>
    </Card>
  );
}

export function OAuthClientList({
  clients,
  trustedClients,
  externalClients,
  copyValue,
  dateTimeFormatter,
  onDeleteClient,
  t,
}: {
  clients: OAuthClientInfo[];
  trustedClients: OAuthClientInfo[];
  externalClients: OAuthClientInfo[];
  copyValue: (value: string, description: string) => Promise<void>;
  dateTimeFormatter: Intl.DateTimeFormat;
  onDeleteClient: (clientId: string) => Promise<void>;
  t: OAuthTranslator;
}) {
  if (clients.length === 0) {
    return (
      <section className="border-border/70 border-y py-4">
        <h2 className="font-semibold text-base leading-6">
          {t("existingClients")}
        </h2>
        <p className="mt-1 text-muted-foreground text-sm leading-6">
          {t("existingClientsDescription")}
        </p>
        <div className="mt-4 border-border/80 border-t border-dashed py-8 text-muted-foreground text-sm">
          {t("noClients")}
        </div>
      </section>
    );
  }

  return (
    <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <OAuthClientSection
        clients={trustedClients}
        copyValue={copyValue}
        dateTimeFormatter={dateTimeFormatter}
        emptyKey="noTrustedClients"
        onDeleteClient={onDeleteClient}
        title={t("sectionTrustedTitle")}
        description={t("sectionTrustedDescription")}
        t={t}
      />
      <OAuthClientSection
        clients={externalClients}
        copyValue={copyValue}
        dateTimeFormatter={dateTimeFormatter}
        emptyKey="noExternalClients"
        onDeleteClient={onDeleteClient}
        title={t("sectionExternalTitle")}
        description={t("sectionExternalDescription")}
        t={t}
      />
    </div>
  );
}
