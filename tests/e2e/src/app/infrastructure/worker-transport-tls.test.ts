import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:https";
import type { Socket } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { expect, test } from "@playwright/test";
import { withWorkerTransport } from "../../../utils/worker-transport";

test("non-owned HTTPS tunnels preserve TLS verification, Host and secure cookies", {
  tag: "@Infrastructure/Runtime",
}, async ({ browser }) => {
  const directory = await mkdtemp(join(tmpdir(), "life-transport-tls-"));
  const sockets = new Set<Socket>();
  const hosts: string[] = [];
  const cookies: string[] = [];
  const key = join(directory, "key.pem"),
    cert = join(directory, "cert.pem");
  let server: ReturnType<typeof createServer> | undefined;
  try {
    await promisify(execFile)("openssl", [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-keyout",
      key,
      "-out",
      cert,
      "-days",
      "1",
      "-subj",
      "/CN=127.0.0.1",
      "-addext",
      "subjectAltName=IP:127.0.0.1",
    ]);
    server = createServer(
      { key: await readFile(key), cert: await readFile(cert) },
      (request, response) => {
        hosts.push(request.headers.host ?? "");
        cookies.push(request.headers.cookie ?? "");
        response.setHeader("content-type", "text/plain");
        response.setHeader(
          "set-cookie",
          "secureSession=tls-only; Secure; HttpOnly; Path=/; SameSite=Lax",
        );
        response.end("owned TLS endpoint");
      },
    );
    server.on("connection", (socket) => {
      sockets.add(socket);
      socket.on("error", () => {});
      socket.on("close", () => sockets.delete(socket));
    });
    await new Promise<void>((resolve, reject) => {
      server?.once("error", reject);
      server?.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No TLS port");
    const origin = `https://127.0.0.1:${address.port}`;
    await withWorkerTransport(
      `http://localhost:${address.port}`,
      async (proxy) => {
        // The explicit exception is limited to this generated self-signed fixture.
        const context = await browser.newContext({
          proxy,
          ignoreHTTPSErrors: true,
        });
        try {
          const page = await context.newPage();
          await page.goto(origin);
          expect(page.url()).toBe(`${origin}/`);
          expect(await page.locator("body").innerText()).toBe(
            "owned TLS endpoint",
          );
          const response = await context.request.get(`${origin}/echo`);
          expect(response.status()).toBe(200);
          expect(response.url()).toBe(`${origin}/echo`);
          expect(await response.text()).toBe("owned TLS endpoint");
          expect(cookies.at(-1)).toContain("secureSession=tls-only");
          expect((await context.cookies(origin))[0]).toMatchObject({
            name: "secureSession",
            domain: "127.0.0.1",
            secure: true,
            httpOnly: true,
          });
          // Compare the browser's loopback cookie rules with an unproxied
          // context, rather than imposing different cookie semantics here.
          const direct = await browser.newContext({ ignoreHTTPSErrors: true });
          try {
            await direct.request.get(origin);
            expect(
              await context.cookies(`http://127.0.0.1:${address.port}`),
            ).toEqual(await direct.cookies(`http://127.0.0.1:${address.port}`));
          } finally {
            await direct.close();
          }
          expect(
            await context.cookies(`https://localhost:${address.port}`),
          ).toEqual([]);
          expect(
            hosts.every((host) => host === `127.0.0.1:${address.port}`),
          ).toBe(true);
        } finally {
          await context.close();
        }
        const verified = await browser.newContext({ proxy });
        try {
          const page = await verified.newPage();
          await expect(page.goto(origin)).rejects.toThrow(
            /ERR_CERT_AUTHORITY_INVALID/,
          );
          await expect(verified.request.get(origin)).rejects.toThrow(
            /self.signed certificate/i,
          );
        } finally {
          await verified.close();
        }
      },
    );
  } finally {
    const closed = [...sockets].map((socket) => {
      const close = new Promise<void>((resolve) =>
        socket.once("close", resolve),
      );
      socket.destroy();
      return close;
    });
    await Promise.all([
      ...closed,
      ...(server?.listening
        ? [
            new Promise<void>((resolve, reject) =>
              server?.close((error) => (error ? reject(error) : resolve())),
            ),
          ]
        : []),
    ]);
    await rm(directory, { recursive: true, force: true });
  }
});
