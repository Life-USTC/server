import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import type { Socket } from "node:net";
import { createDeferred } from "../../shared/deferred";

/** Real HTTP timing signal, separate from every product request and origin. */
export async function createNativeBrowserSignal(origin: string) {
  const path = "/signal/" + randomUUID();
  const gate = createDeferred();
  const sockets = new Set<Socket>();
  const operations = new Set<Promise<void>>();
  const errors: unknown[] = [];
  let received = 0;
  let completed = 0;
  const server = createServer((request, response) => {
    const finished = new Promise<void>((resolve, reject) => {
      response.once("finish", resolve);
      response.once("error", reject);
      response.once("close", () => {
        if (!response.writableFinished)
          reject(new Error("Native control response closed before finish"));
      });
    });
    void finished.catch(() => undefined);
    const operation = (async () => {
      if (
        request.method !== "GET" ||
        request.url !== path ||
        request.headers.origin !== origin ||
        request.headers.cookie !== undefined ||
        received !== 0
      ) {
        errors.push(new Error("Unexpected native control signal request"));
        response.writeHead(404, { connection: "close" });
        response.end();
        await finished;
        return;
      }
      received++;
      await gate.promise;
      response.writeHead(200, {
        "access-control-allow-origin": origin,
        "cache-control": "no-store",
        "content-type": "text/plain",
        connection: "close",
      });
      response.end("continue");
      await finished;
      completed++;
    })();
    operations.add(operation);
    void operation.then(
      () => operations.delete(operation),
      (error) => {
        errors.push(error);
        operations.delete(operation);
      },
    );
  });
  server.on("error", (error) => errors.push(error));
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.once("close", () => sockets.delete(socket));
  });

  async function close() {
    gate.resolve();
    if (server.listening) {
      const closed = new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
      for (const socket of sockets) socket.destroy();
      await closed;
    }
    while (operations.size) await Promise.allSettled(operations);
    if (sockets.size || server.listening)
      errors.push(new Error("Native control server retained resources"));
    if (errors.length)
      throw new AggregateError(errors, "Native control signal failed");
  }

  try {
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => {
        server.off("error", reject);
        resolve();
      });
    });
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("Native control signal has no TCP port");
    return {
      url: "http://127.0.0.1:" + address.port + path,
      get received() {
        return received;
      },
      get completed() {
        return completed;
      },
      get pending() {
        return operations.size;
      },
      errors,
      release: () => gate.resolve(),
      close,
    };
  } catch (error) {
    try {
      await close();
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        "Native signal setup failed",
      );
    }
    throw error;
  }
}
