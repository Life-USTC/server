import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { auth } from "@/auth";
import { buildSignInRedirectUrl } from "@/lib/auth/auth-routing";
import { prisma } from "@/lib/db/prisma";
import { buildSearchParams } from "@/lib/navigation/search-params";
import { DEVICE_CODE_STATUS, normalizeUserCode } from "@/lib/oauth/device-code";
import { approveDeviceCode, denyDeviceCode } from "./actions";

export const metadata: Metadata = { title: "Device Login" };
export const dynamic = "force-dynamic";

function DevicePanel({
  children,
  textCenter = false,
}: {
  children: ReactNode;
  textCenter?: boolean;
}) {
  return (
    <main className="page-main flex min-h-[calc(100vh-8rem)] items-center justify-center">
      <div
        className={
          textCenter
            ? "w-full max-w-md rounded-lg border p-8 text-center"
            : "w-full max-w-md rounded-lg border p-8"
        }
      >
        {children}
      </div>
    </main>
  );
}

function DeviceMessage({
  title,
  children,
  showRetry = false,
}: {
  title: string;
  children: ReactNode;
  showRetry?: boolean;
}) {
  return (
    <DevicePanel textCenter>
      <h1 className="mb-2 font-semibold text-2xl text-destructive">{title}</h1>
      <p className="text-muted-foreground">{children}</p>
      {showRetry ? (
        <a href="/oauth/device" className="mt-4 inline-block underline">
          Try again
        </a>
      ) : null}
    </DevicePanel>
  );
}

export default async function DeviceVerifyPage({
  searchParams,
}: {
  searchParams: Promise<{
    code?: string;
    step?: string;
    result?: string;
    reason?: string;
  }>;
}) {
  const [session, params] = await Promise.all([auth(), searchParams]);

  if (!session?.user?.id) {
    const callbackQuery = buildSearchParams({
      values: {
        code: params.code,
        step: params.step,
        result: params.result,
        reason: params.reason,
      },
    });
    const callbackUrl = callbackQuery
      ? `/oauth/device?${callbackQuery}`
      : "/oauth/device";
    redirect(buildSignInRedirectUrl({}, callbackUrl));
  }

  // Result screen after approve/deny
  if (params.result) {
    return (
      <DevicePanel textCenter>
        {params.result === "approved" && (
          <>
            <h1 className="mb-2 font-semibold text-2xl">Device Approved</h1>
            <p className="text-muted-foreground">
              You have authorized the device. You can close this page.
            </p>
          </>
        )}
        {params.result === "denied" && (
          <>
            <h1 className="mb-2 font-semibold text-2xl">Device Denied</h1>
            <p className="text-muted-foreground">
              The device login request was denied.
            </p>
          </>
        )}
        {params.result === "error" && (
          <>
            <h1 className="mb-2 font-semibold text-2xl text-destructive">
              Error
            </h1>
            <p className="text-muted-foreground">
              {params.reason === "missing_code" &&
                "No device code was provided."}
              {params.reason === "invalid_or_expired" &&
                "The device code is invalid or has expired."}
              {!params.reason && "An unknown error occurred."}
            </p>
            <a href="/oauth/device" className="mt-4 inline-block underline">
              Try again
            </a>
          </>
        )}
      </DevicePanel>
    );
  }

  // Approval step: look up the code and show approve/deny
  if (params.code && params.step === "approve") {
    const userCode = normalizeUserCode(params.code);
    const record = await prisma.deviceCode.findUnique({
      where: { userCode },
      include: { client: { select: { clientId: true, name: true } } },
    });

    if (!record) {
      return (
        <DeviceMessage title="Code Not Found" showRetry>
          No device login request matches this code.
        </DeviceMessage>
      );
    }

    if (record.expiresAt < new Date()) {
      return (
        <DeviceMessage title="Code Expired">
          This device code has expired. Please start a new login on your device.
        </DeviceMessage>
      );
    }

    if (record.status !== DEVICE_CODE_STATUS.PENDING) {
      return (
        <DeviceMessage title="Code Already Used">
          This device code has already been {record.status}.
        </DeviceMessage>
      );
    }

    const clientName = record.client.name ?? record.client.clientId;

    return (
      <DevicePanel>
        <h1 className="mb-2 text-center font-semibold text-2xl">
          Device Login
        </h1>
        <p className="mb-6 text-center text-muted-foreground">
          <strong>{clientName}</strong> is requesting access to your account.
        </p>

        {record.scopes.length > 0 && (
          <div className="mb-6 rounded-lg bg-muted/50 p-4">
            <p className="mb-2 font-medium text-sm">Requested permissions:</p>
            <ul className="list-inside list-disc space-y-1 text-muted-foreground text-sm">
              {record.scopes.map((scope) => (
                <li key={scope}>{scope}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex gap-3">
          <form action={denyDeviceCode} className="flex-1">
            <input type="hidden" name="userCode" value={record.userCode} />
            <button
              type="submit"
              className="w-full rounded-md border px-4 py-2 text-sm hover:bg-muted"
            >
              Deny
            </button>
          </form>
          <form action={approveDeviceCode} className="flex-1">
            <input type="hidden" name="userCode" value={record.userCode} />
            <button
              type="submit"
              className="w-full rounded-md bg-primary px-4 py-2 text-primary-foreground text-sm hover:bg-primary/90"
            >
              Approve
            </button>
          </form>
        </div>
      </DevicePanel>
    );
  }

  // Default: code entry form
  return (
    <DevicePanel>
      <h1 className="mb-2 text-center font-semibold text-2xl">Device Login</h1>
      <p className="mb-6 text-center text-muted-foreground">
        Enter the code displayed on your device.
      </p>

      <form action="/oauth/device" method="GET">
        <input type="hidden" name="step" value="approve" />
        <label htmlFor="code" className="mb-1 block font-medium text-sm">
          Device Code
        </label>
        <input
          id="code"
          name="code"
          type="text"
          required
          autoComplete="off"
          placeholder="XXXX-XXXX"
          defaultValue={params.code ?? ""}
          className="mb-4 w-full rounded-md border bg-background px-3 py-2 text-center font-mono text-lg tracking-widest placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          type="submit"
          className="w-full rounded-md bg-primary px-4 py-2 text-primary-foreground text-sm hover:bg-primary/90"
        >
          Verify
        </button>
      </form>
    </DevicePanel>
  );
}
