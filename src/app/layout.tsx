import type { Metadata } from "next";
import { headers } from "next/headers";
import Script from "next/script";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { AppLogo } from "@/components/app-logo";
import BottomBar from "@/components/bottom-bar";
import { Providers } from "@/components/providers";
import { AnchoredToastProvider, ToastProvider } from "@/components/ui/toast";
import { UserMenu } from "@/components/user-menu";
import { getCanonicalOrigin } from "@/lib/site-url";
import "./globals.css";

type FontClassNames = {
  sans: string;
  fallback: string;
  mono: string;
};

let fontClassNamesCache: FontClassNames = {
  sans: "",
  fallback: "",
  mono: "",
};
let fontClassNamesLoaded = false;

async function getFontClassNames(): Promise<FontClassNames> {
  if (fontClassNamesLoaded) return fontClassNamesCache;
  fontClassNamesLoaded = true;

  try {
    const googleFonts = await import("next/font/google");
    const [ibmPlexSans, notoSansSc, jetBrainsMono] = await Promise.all([
      googleFonts.IBM_Plex_Sans({
        subsets: ["latin"],
        weight: ["400", "500", "600", "700"],
        display: "swap",
        variable: "--font-sans",
      }),
      googleFonts.Noto_Sans_SC({
        subsets: ["latin"],
        weight: ["400", "500", "600", "700"],
        display: "swap",
        variable: "--font-sans-fallback",
      }),
      googleFonts.JetBrains_Mono({
        subsets: ["latin"],
        display: "swap",
        variable: "--font-mono",
      }),
    ]);

    fontClassNamesCache = {
      sans: ibmPlexSans.variable,
      fallback: notoSansSc.variable,
      mono: jetBrainsMono.variable,
    };
  } catch {
    fontClassNamesCache = {
      sans: "",
      fallback: "",
      mono: "",
    };
  }

  return fontClassNamesCache;
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");

  return {
    metadataBase: new URL(getCanonicalOrigin()),
    title: {
      default: t("title"),
      template: t("titleTemplate"),
    },
    description: t("description"),
    openGraph: {
      type: "website",
      siteName: t("title"),
      locale: "zh_CN",
      alternateLocale: "en_US",
    },
    twitter: {
      card: "summary",
    },
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const fontClassNames = await getFontClassNames();
  const headerStore = await headers();
  const nonce = headerStore.get("x-csp-nonce") ?? undefined;

  // Get messages for the current locale (cookie / Accept-Language via src/proxy.ts)
  const [messages, a11yT, locale, session] = await Promise.all([
    getMessages(),
    getTranslations("accessibility"),
    getLocale(),
    auth(),
  ]);

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${fontClassNames.sans} ${fontClassNames.fallback} ${fontClassNames.mono}`}
    >
      <head>
        <Script
          nonce={nonce}
          src="https://www.googletagmanager.com/gtag/js?id=G-JNK35J2Q3R"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" nonce={nonce} strategy="afterInteractive">
          {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-JNK35J2Q3R');`}
        </Script>
      </head>
      <body className="font-sans antialiased">
        <a
          href="#main-content"
          className="sr-only fixed top-4 left-4 z-[60] rounded-md bg-background px-3 py-2 text-sm shadow-sm focus:not-sr-only focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {a11yT("skipToMainContent")}
        </a>
        <Providers nonce={nonce}>
          <NextIntlClientProvider messages={messages}>
            <ToastProvider>
              <AnchoredToastProvider>
                <div className="flex min-h-screen flex-col">
                  <div className="flex-1">
                    <div className="scroll-mt-4" id="main-content">
                      <div
                        id="app-brand-row"
                        className="page-main pointer-events-none relative flex items-start justify-between gap-4 pt-4 pb-0 md:pt-5 lg:pt-6"
                      >
                        <div className="pointer-events-auto" id="app-logo">
                          <AppLogo />
                        </div>
                        {session?.user ? (
                          <div
                            className="pointer-events-auto"
                            id="app-user-menu"
                          >
                            <UserMenu
                              initialUser={{
                                id: session.user.id,
                                name: session.user.name ?? null,
                                image: session.user.image ?? null,
                                username:
                                  typeof session.user.username === "string"
                                    ? session.user.username
                                    : null,
                              }}
                            />
                          </div>
                        ) : null}
                      </div>
                      {children}
                    </div>
                  </div>
                  <div id="app-bottom-bar">
                    <BottomBar />
                  </div>
                </div>
              </AnchoredToastProvider>
            </ToastProvider>
          </NextIntlClientProvider>
        </Providers>
      </body>
    </html>
  );
}
