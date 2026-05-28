"use client";

import { ShieldCheck } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  AUTH_METHOD_OPTIONS,
  getAuthMethodOption,
  getScopeInputId,
  type OAuthTranslator,
  parseRedirectUris,
  SCOPE_OPTIONS,
} from "./oauth-client-manager-shared";

export function OAuthClientCreateDialog({
  createDialogOpen,
  formKey,
  loading,
  onCreateClient,
  redirectDraft,
  selectedAuthMethod,
  selectedScopes,
  setCreateDialogOpen,
  setRedirectDraft,
  setSelectedAuthMethod,
  toggleScope,
  t,
}: {
  createDialogOpen: boolean;
  formKey: number;
  loading: boolean;
  onCreateClient: (formData: FormData) => Promise<void>;
  redirectDraft: string;
  selectedAuthMethod: string;
  selectedScopes: string[];
  setCreateDialogOpen: (open: boolean) => void;
  setRedirectDraft: (value: string) => void;
  setSelectedAuthMethod: (value: string) => void;
  toggleScope: (scope: string, nextChecked: boolean) => void;
  t: OAuthTranslator;
}) {
  const draftRedirectUris = parseRedirectUris(redirectDraft);
  const selectedAuthMethodMeta = getAuthMethodOption(selectedAuthMethod);

  return (
    <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
      <DialogPopup className="max-h-[min(90vh,48rem)] max-w-4xl">
        <DialogHeader>
          <DialogTitle>{t("createClient")}</DialogTitle>
          <DialogDescription>{t("createClientDescription")}</DialogDescription>
        </DialogHeader>
        <form
          key={formKey}
          action={onCreateClient}
          className="flex min-h-0 flex-1 flex-col"
        >
          <DialogPanel className="space-y-6">
            <fieldset className="space-y-3">
              <legend className="font-heading font-semibold text-sm">
                {t("createFlowTitle")}
              </legend>
              <p className="text-muted-foreground text-sm leading-6">
                {t("createFlowIntro")}
              </p>
              <div className="grid gap-3 xl:grid-cols-3">
                {AUTH_METHOD_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  const inputId = `oauth-auth-method-${option.value}`;
                  const checked = selectedAuthMethod === option.value;

                  return (
                    <label
                      htmlFor={inputId}
                      key={option.value}
                      className={cn(
                        "cursor-pointer rounded-lg border p-4 transition-colors",
                        checked
                          ? option.accentClassName
                          : "border-border bg-card/72 hover:bg-accent/40",
                      )}
                    >
                      <input
                        id={inputId}
                        type="radio"
                        name="tokenEndpointAuthMethod"
                        value={option.value}
                        checked={checked}
                        onChange={() => setSelectedAuthMethod(option.value)}
                        className="sr-only"
                      />
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            "flex size-10 shrink-0 items-center justify-center rounded-lg border",
                            checked
                              ? option.accentIconClassName
                              : "border-border bg-background/80 text-muted-foreground",
                          )}
                        >
                          <Icon className="size-4.5" />
                        </div>
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-sm">
                              {t(option.strategyTitleKey)}
                            </span>
                            <Badge variant="outline">
                              {t(option.labelKey)}
                            </Badge>
                          </div>
                          <p className="text-muted-foreground text-xs leading-5">
                            {t(option.descriptionKey)}
                          </p>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <Alert variant="info">
              <ShieldCheck className="mt-0.5 size-4" />
              <AlertTitle>{t("panelSecurityTitle")}</AlertTitle>
              <AlertDescription>
                {t("panelSecurityDescription")}
              </AlertDescription>
            </Alert>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
              <div className="space-y-6">
                <Field>
                  <FieldLabel htmlFor="oauth-client-name">
                    {t("clientName")}
                  </FieldLabel>
                  <Input
                    id="oauth-client-name"
                    name="name"
                    placeholder={t("clientNamePlaceholder")}
                    required
                  />
                </Field>

                <Field>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <FieldLabel htmlFor="oauth-redirect-uris">
                      {t("redirectUris")}
                    </FieldLabel>
                    <span
                      aria-live="polite"
                      className="text-muted-foreground text-xs"
                    >
                      {t("previewRedirectCount", {
                        count: draftRedirectUris.length,
                      })}
                    </span>
                  </div>
                  <Textarea
                    id="oauth-redirect-uris"
                    name="redirectUris"
                    className="min-h-32 font-mono text-sm"
                    placeholder={t("redirectUrisPlaceholder")}
                    value={redirectDraft}
                    onChange={(event) => setRedirectDraft(event.target.value)}
                    required
                  />
                  <FieldDescription>{t("redirectUrisHint")}</FieldDescription>
                </Field>
              </div>

              <Field className="rounded-2xl border border-border/80 bg-muted/15 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <FieldLabel>{t("permissionsTitle")}</FieldLabel>
                  <span
                    aria-live="polite"
                    className="text-muted-foreground text-xs"
                  >
                    {t("previewScopeCount", {
                      count: selectedScopes.length,
                    })}
                  </span>
                </div>
                <FieldDescription>{t("permissionsHint")}</FieldDescription>

                <div className="mt-2 space-y-3">
                  {SCOPE_OPTIONS.map((scope) => {
                    const checked = selectedScopes.includes(scope.value);
                    const inputId = getScopeInputId(scope.value);

                    return (
                      <label
                        htmlFor={inputId}
                        key={scope.value}
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors",
                          checked
                            ? "border-primary/32 bg-primary/5"
                            : "border-border bg-background/80 hover:bg-accent/40",
                        )}
                      >
                        <Checkbox
                          id={inputId}
                          checked={checked}
                          onCheckedChange={(value) =>
                            toggleScope(scope.value, Boolean(value))
                          }
                        />
                        <span className="min-w-0 space-y-1">
                          <span className="block font-medium text-sm">
                            <span translate="no">
                              {t(`scope_${scope.value}`, {
                                fallback: scope.value,
                              })}
                            </span>
                          </span>
                          <span className="block text-muted-foreground text-xs leading-5">
                            {t(scope.descriptionKey)}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>

                {selectedScopes.map((scope) => (
                  <input
                    key={scope}
                    type="hidden"
                    name="scopes"
                    value={scope}
                  />
                ))}

                <div className="mt-4 rounded-xl border border-border/80 border-dashed bg-background/72 p-3">
                  <p className="font-medium text-sm">
                    {t(selectedAuthMethodMeta.strategyTitleKey)}
                  </p>
                  <p className="mt-1 text-muted-foreground text-xs leading-5">
                    {t(selectedAuthMethodMeta.strategyHintKey)}
                  </p>
                </div>
              </Field>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
              <p className="text-muted-foreground text-xs leading-5">
                {t("createClientFootnote")}
              </p>
              <Button
                type="submit"
                disabled={loading || selectedScopes.length === 0}
              >
                {loading ? t("creating") : t("createClient")}
              </Button>
            </div>
          </DialogPanel>
        </form>
      </DialogPopup>
    </Dialog>
  );
}
