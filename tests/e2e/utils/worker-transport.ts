import { connect, createServer, type Socket } from "node:net";
import { Socks5Server } from "@pondwader/socks5-server";

/** Per-case SOCKS transport. Playwright keeps original URLs and its cookie jar. */
export function ownWorkerTransport(origin: string) {
  const owned = new URL(origin);
  if (owned.protocol !== "http:" || owned.hostname !== "localhost")
    throw new Error("Worker transport requires an HTTP localhost origin");
  const port = Number(owned.port || 80);
  const protocol = new Socks5Server();
  const sockets = new Map<Socket, Promise<void>>();
  let starting: Promise<{ server: string }> | undefined;
  let disposing: Promise<void> | undefined;
  let closing = false;
  let address: string | undefined;
  const closeError = new Error("Owned Worker transport disposed");
  const own = (socket: Socket) => {
    sockets.set(
      socket,
      new Promise<void>((resolve) =>
        socket.once("close", () => {
          sockets.delete(socket);
          resolve();
        }),
      ),
    );
    // Expected network errors surface through the browser/request that owns them.
    socket.on("error", () => {});
    return socket;
  };
  const listener = createServer((socket) => {
    own(socket);
    if (closing) {
      socket.destroy(closeError);
      return;
    }
    // Documented custom-Duplex entry point; the library owns all SOCKS parsing.
    protocol._handleConnection(socket);
  });
  protocol.setConnectionHandler((connection, sendStatus) => {
    const source = connection.socket;
    if (closing || source.destroyed) {
      source.destroy(closeError);
      return;
    }
    const target = own(
      connect({
        host: connection.destAddress,
        port: connection.destPort,
        ...(connection.destAddress === owned.hostname &&
        connection.destPort === port
          ? { family: 4 }
          : {}),
      }),
    );
    let connected = false;
    target.once("connect", () => {
      connected = true;
      if (closing || source.destroyed) {
        target.destroy(closeError);
        return;
      }
      sendStatus("REQUEST_GRANTED");
      source.pipe(target);
      target.pipe(source);
    });
    source.once("close", () => target.destroy());
    source.once("error", () => target.destroy());
    target.once("error", (error: NodeJS.ErrnoException) => {
      if (!connected && !source.destroyed)
        sendStatus(
          error.code === "ECONNREFUSED"
            ? "CONNECTION_REFUSED"
            : "GENERAL_FAILURE",
        );
      source.destroy();
    });
    target.once("close", () => {
      // A clean EOF is piped through end(), which flushes buffered response data.
      // A reset must fail the original request, with no reconnect or replay.
      if (!target.readableEnded) source.destroy();
    });
  });
  return {
    start() {
      if (closing) return Promise.reject(closeError);
      if (starting)
        return Promise.reject(new Error("Worker transport was started twice"));
      starting = (async () => {
        await new Promise<void>((resolve, reject) => {
          const failed = (error: Error) => {
            listener.off("listening", ready);
            reject(error);
          };
          const ready = () => {
            listener.off("error", failed);
            resolve();
          };
          listener.once("error", failed);
          listener.once("listening", ready);
          listener.listen(0, "127.0.0.1");
        });
        const bound = listener.address();
        if (!bound || typeof bound === "string")
          throw new Error("Worker transport did not bind a port");
        address = `socks5://127.0.0.1:${bound.port}`;
        if (closing) throw closeError;
        return { server: address };
      })();
      return starting;
    },
    dispose() {
      closing = true;
      disposing ??= (async () => {
        // Join a bind that completes after teardown starts. Late handshakes are
        // rejected before allocating a target, so this owns both socket sides.
        await starting?.catch(() => undefined);
        const closed = [...sockets.values()];
        for (const socket of sockets.keys()) socket.destroy(closeError);
        const results = await Promise.allSettled([
          ...(listener.listening
            ? [
                new Promise<void>((resolve, reject) =>
                  listener.close((error) =>
                    error ? reject(error) : resolve(),
                  ),
                ),
              ]
            : []),
          ...closed,
        ]);
        const errors = results.flatMap((result) =>
          result.status === "rejected" ? [result.reason] : [],
        );
        if (sockets.size || listener.listening)
          errors.push(new Error("Worker transport resources remain open"));
        if (errors.length)
          throw new AggregateError(errors, "Worker transport cleanup failed");
      })();
      return disposing;
    },
    state: () => ({
      address,
      connections: sockets.size,
      listening: listener.listening,
      closing,
    }),
  };
}

export async function withWorkerTransport<T>(
  origin: string,
  use: (proxy: { server: string }) => Promise<T>,
) {
  const transport = ownWorkerTransport(origin);
  const errors: unknown[] = [];
  let value: T | undefined;
  try {
    value = await use(await transport.start());
  } catch (error) {
    errors.push(error);
  }
  try {
    await transport.dispose();
  } catch (error) {
    errors.push(error);
  }
  if (errors.length === 1) throw errors[0];
  if (errors.length)
    throw new AggregateError(errors, "Worker transport and cleanup failed");
  return value as T;
}
