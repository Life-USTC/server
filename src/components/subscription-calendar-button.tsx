"use client";

import {
  Bell,
  BellOff,
  Calendar,
  CheckIcon,
  CopyIcon,
  LogIn,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  addSectionToSubscription,
  getSubscriptionState,
  removeSectionFromSubscription,
  type SubscriptionState,
} from "@/app/actions/subscription";
import { SignInLink } from "@/components/sign-in-link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { anchoredToastManager, toastManager } from "@/components/ui/toast";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@/components/ui/tooltip";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { Link } from "@/i18n/routing";
import { logClientError } from "@/lib/log/app-logger";

interface SubscriptionCalendarButtonProps {
  sectionDatabaseId: number;
  sectionJwId: number;
  showCalendarButton?: boolean;
  showSubscribeButton?: boolean;
}

export function SubscriptionCalendarButton({
  sectionDatabaseId,
  sectionJwId,
  showCalendarButton = true,
  showSubscribeButton = true,
}: SubscriptionCalendarButtonProps) {
  const t = useTranslations("sectionDetail");
  const tA11y = useTranslations("accessibility");
  const router = useRouter();
  const [subscriptionState, setSubscriptionState] =
    useState<SubscriptionState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOperating, setIsOperating] = useState(false);
  const [origin, setOrigin] = useState("");

  const singleCopyButtonRef = useRef<HTMLButtonElement>(null);
  const subscriptionCopyButtonRef = useRef<HTMLButtonElement>(null);
  const toastTimeout = 2000;

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const { copyToClipboard: copySingle, isCopied: isSingleCopied } =
    useCopyToClipboard({
      onCopy: () => {
        if (singleCopyButtonRef.current) {
          anchoredToastManager.add({
            data: { tooltipStyle: true },
            positionerProps: { anchor: singleCopyButtonRef.current },
            timeout: toastTimeout,
            title: t("copied"),
          });
        }
      },
      timeout: toastTimeout,
    });

  const { copyToClipboard: copySubscription, isCopied: isSubscriptionCopied } =
    useCopyToClipboard({
      onCopy: () => {
        if (subscriptionCopyButtonRef.current) {
          anchoredToastManager.add({
            data: { tooltipStyle: true },
            positionerProps: { anchor: subscriptionCopyButtonRef.current },
            timeout: toastTimeout,
            title: t("copied"),
          });
        }
      },
      timeout: toastTimeout,
    });

  // Fetch subscription state on mount
  const fetchState = useCallback(async () => {
    setIsLoading(true);
    try {
      const state = await getSubscriptionState();
      setSubscriptionState(state);
    } catch (e) {
      logClientError("Failed to fetch subscription state", e, {
        feature: "calendar-subscription",
        sectionDatabaseId,
        sectionJwId,
      });
    } finally {
      setIsLoading(false);
    }
  }, [sectionDatabaseId, sectionJwId]);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  // Derived state
  const isAuthenticated = subscriptionState?.isAuthenticated ?? false;
  const isSubscribed =
    subscriptionState?.subscribedSections.includes(sectionDatabaseId) ?? false;
  const subscriptionIcsUrl = subscriptionState?.subscriptionIcsUrl ?? null;

  // Single section calendar URL
  const singleCalendarUrl = origin
    ? `${origin}/api/sections/${sectionJwId}/calendar.ics`
    : "";

  // Full subscription ICS URL
  const fullSubscriptionUrl =
    origin && subscriptionIcsUrl ? `${origin}${subscriptionIcsUrl}` : "";
  const canCopySingle = Boolean(singleCalendarUrl);
  const canCopySubscription = Boolean(fullSubscriptionUrl);

  const handleCopySingle = () => {
    if (!canCopySingle) return;
    copySingle(singleCalendarUrl);
  };

  const handleCopySubscription = () => {
    if (!canCopySubscription) return;
    copySubscription(fullSubscriptionUrl);
  };

  const handleSubscribeToggle = async () => {
    if (!isAuthenticated) {
      // This shouldn't happen as the button is replaced with login prompt
      return;
    }

    setIsOperating(true);

    const promise = isSubscribed
      ? removeSectionFromSubscription(sectionDatabaseId)
      : addSectionToSubscription(sectionDatabaseId);

    toastManager.promise(promise, {
      loading: {
        title: isSubscribed ? t("unsubscribing") : t("subscribing"),
        description: t("pleaseWait"),
      },
      success: (newState) => {
        setSubscriptionState(newState);
        setIsOperating(false);
        return {
          title: isSubscribed ? t("unsubscribeSuccess") : t("subscribeSuccess"),
          description: isSubscribed
            ? t("unsubscribeSuccessDescription")
            : t("subscribeSuccessDescription"),
          actionProps: {
            children: t("viewAllSubscriptions"),
            onClick: () => {
              router.push("/?tab=subscriptions");
            },
          },
        };
      },
      error: (error) => {
        setIsOperating(false);
        return {
          title: t("operationFailed"),
          description:
            error instanceof Error ? error.message : t("pleaseRetry"),
        };
      },
    });
  };

  // Show skeleton while loading
  if (isLoading) {
    return (
      <div className="flex gap-2">
        {showSubscribeButton && (
          <Button variant="outline" disabled>
            <Bell className="h-5 w-5" />
          </Button>
        )}
        {showCalendarButton && (
          <Button variant="outline" disabled>
            <Calendar className="h-5 w-5" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      {/* Subscribe/Unsubscribe Button or Login Prompt */}
      {showSubscribeButton &&
        (isAuthenticated && isSubscribed ? (
          <Button
            onClick={handleSubscribeToggle}
            disabled={isOperating}
            variant="default"
            aria-label={t("unsubscribeLabel")}
          >
            <BellOff className="h-5 w-5" />
          </Button>
        ) : isAuthenticated ? (
          <Dialog>
            <DialogTrigger
              render={
                <Button
                  variant="outline"
                  disabled={isOperating}
                  aria-label={t("subscribeLabel")}
                />
              }
            >
              <Bell className="h-5 w-5" />
            </DialogTrigger>
            <DialogPopup>
              <DialogHeader>
                <DialogTitle>{t("subscribeLabel")}</DialogTitle>
                <DialogDescription>
                  {t("subscriptionDisclaimer")}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose render={<Button variant="outline" />}>
                  {t("close")}
                </DialogClose>
                <DialogClose
                  render={
                    <Button
                      disabled={isOperating}
                      onClick={handleSubscribeToggle}
                    />
                  }
                >
                  <Bell className="mr-2 h-4 w-4" />
                  {t("subscribeLabel")}
                </DialogClose>
              </DialogFooter>
            </DialogPopup>
          </Dialog>
        ) : (
          <Dialog>
            <DialogTrigger
              render={
                <Button variant="outline" aria-label={t("subscribeLabel")} />
              }
            >
              <Bell className="h-5 w-5" />
            </DialogTrigger>
            <DialogPopup>
              <DialogHeader>
                <DialogTitle>{t("loginRequired")}</DialogTitle>
                <DialogDescription>
                  {t("loginRequiredDescription")}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose render={<Button variant="outline" />}>
                  {t("close")}
                </DialogClose>
                <Button render={<SignInLink />}>
                  <LogIn className="mr-2 h-4 w-4" />
                  {t("loginToSubscribe")}
                </Button>
              </DialogFooter>
            </DialogPopup>
          </Dialog>
        ))}

      {/* Calendar Dialog */}
      {showCalendarButton && (
        <Dialog>
          <DialogTrigger
            render={
              <Button variant="outline" aria-label={t("addToCalendar")} />
            }
          >
            <Calendar className="h-5 w-5" />
          </DialogTrigger>
          <DialogPopup>
            <DialogHeader>
              <DialogTitle>{t("calendarSheetTitle")}</DialogTitle>
              <DialogDescription>
                {t("calendarSheetDescription")}{" "}
                <a
                  href="https://en.wikipedia.org/wiki/ICalendar"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  {t("learnMoreAboutICalendar")}
                </a>
              </DialogDescription>
            </DialogHeader>

            <DialogPanel>
              <div className="space-y-6">
                {/* Subscription Calendar (if exists and authenticated) */}
                {isAuthenticated && subscriptionIcsUrl && (
                  <div className="space-y-3">
                    <label
                      htmlFor="subscription-url"
                      className="block font-medium text-small"
                    >
                      {t("subscriptionUrlLabel")}
                    </label>
                    <p className="text-muted-foreground text-small">
                      {t("subscriptionHintLabel")}{" "}
                      <Link
                        href="/?tab=subscriptions"
                        className="text-primary hover:underline"
                      >
                        {t("viewAllSubscriptions")} →
                      </Link>
                    </p>
                    <div className="flex items-center gap-2">
                      <Input
                        id="subscription-url"
                        aria-label={tA11y("subscriptionCalendarUrl")}
                        disabled
                        placeholder={fullSubscriptionUrl}
                        type="url"
                      />
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Button
                              aria-label={t("copyToClipboard")}
                              disabled={
                                isSubscriptionCopied || !canCopySubscription
                              }
                              onClick={handleCopySubscription}
                              ref={subscriptionCopyButtonRef}
                              size="icon"
                              variant="outline"
                            />
                          }
                        >
                          {isSubscriptionCopied ? (
                            <CheckIcon className="h-6 w-6" />
                          ) : (
                            <CopyIcon className="h-6 w-6" />
                          )}
                        </TooltipTrigger>
                        <TooltipPopup>
                          <p>{t("copyToClipboard")}</p>
                        </TooltipPopup>
                      </Tooltip>
                    </div>
                  </div>
                )}

                {/* Single Section Calendar */}
                <div className="space-y-3">
                  <label
                    htmlFor="calendar-url"
                    className="block font-medium text-small"
                  >
                    {t("calendarUrlLabel")}
                  </label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="calendar-url"
                      aria-label={tA11y("singleSectionCalendarUrl")}
                      disabled
                      placeholder={singleCalendarUrl}
                      type="url"
                    />
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            aria-label={t("copyToClipboard")}
                            disabled={isSingleCopied || !canCopySingle}
                            onClick={handleCopySingle}
                            ref={singleCopyButtonRef}
                            size="icon"
                            variant="outline"
                          />
                        }
                      >
                        {isSingleCopied ? (
                          <CheckIcon className="h-6 w-6" />
                        ) : (
                          <CopyIcon className="h-6 w-6" />
                        )}
                      </TooltipTrigger>
                      <TooltipPopup>
                        <p>{t("copyToClipboard")}</p>
                      </TooltipPopup>
                    </Tooltip>
                  </div>
                </div>
              </div>
            </DialogPanel>

            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>
                {t("close")}
              </DialogClose>
            </DialogFooter>
          </DialogPopup>
        </Dialog>
      )}
    </div>
  );
}
