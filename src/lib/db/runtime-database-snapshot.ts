import {
  createPrismaAdapter,
  type RuntimeDatabase,
  type RuntimeDatabaseAdapter,
  reportDatabaseConnectionError,
} from "./prisma-adapter";

type SnapshotQueryable = Pick<
  ReturnType<RuntimeDatabaseAdapter["underlyingDriver"]>,
  "query"
>;

/** Fixed SQL snapshots use a request-owned connection without an ORM engine. */
export async function withRuntimeDatabaseSnapshot<T>(
  database: RuntimeDatabase,
  limits: { maxWaitMs: number; timeoutMs: number },
  action: (connection: SnapshotQueryable) => Promise<T>,
): Promise<T> {
  const adapter = await createPrismaAdapter(
    undefined,
    database,
    limits.maxWaitMs,
  ).connect();
  try {
    const connection = await adapter.underlyingDriver().connect();
    let released = false;
    let expired = false;
    const release = (destroy = false) => {
      if (released) return;
      released = true;
      connection.release(destroy);
    };
    const timeout = setTimeout(() => {
      expired = true;
      // Stop waiting and prevent issuing COMMIT after the deadline. PostgreSQL
      // may finish the active statement before noticing the disconnect, so the
      // caller must also set a server-side statement_timeout for its fixed SQL.
      release(true);
    }, limits.timeoutMs);
    const onError = (error: Error) => {
      if (!expired) reportDatabaseConnectionError(error);
      release(true);
    };
    connection.on("error", onError);
    try {
      await connection.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
      const result = await action(connection);
      if (expired) throw new Error("Database snapshot transaction timed out");
      await connection.query("COMMIT");
      if (expired) throw new Error("Database snapshot transaction timed out");
      return result;
    } catch (error) {
      if (!released) {
        try {
          await connection.query("ROLLBACK");
        } catch {
          release(true);
        }
      }
      throw error;
    } finally {
      clearTimeout(timeout);
      connection.removeListener("error", onError);
      release();
    }
  } finally {
    await adapter.dispose();
  }
}
