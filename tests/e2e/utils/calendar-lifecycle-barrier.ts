import { randomInt, randomUUID } from "node:crypto";
import { expect } from "@playwright/test";
import { Client } from "pg";
import type { IsolatedDatabase } from "../../shared/isolated-database-lifecycle";

type BlockedQuery = {
  pid: number;
  datname: string;
  application_name: string;
  query: string;
  holder: number;
};
const identifier = (value: string) => `"${value.replaceAll('"', '""')}"`;
const literal = (value: string) => `'${value.replaceAll("'", "''")}'`;

/** Gate actual application SQL only in this case's disposable database. */
export async function calendarLifecycleBarrier(database: IsolatedDatabase) {
  const namespace = 0x43414c;
  const key = randomInt(1, 0x7fffffff);
  const marker = `calendar-lifecycle-${randomUUID()}`;
  const client = new Client({
    connectionString: database.connections.owner,
    application_name: `${marker}-holder`,
  });
  const errors: Error[] = [];
  client.on("error", (error) => errors.push(error));
  let released = false;
  let releaseRequested = false;
  let holder = 0;
  let blocked: BlockedQuery | undefined;
  try {
    await client.connect();
    holder = (
      await client.query<{ pid: number }>("SELECT pg_backend_pid() pid")
    ).rows[0].pid;
    await client.query("SELECT pg_advisory_lock($1, $2)", [namespace, key]);
    await client.query("CREATE SCHEMA calendar_lifecycle");
  } catch (error) {
    await client.end();
    throw error;
  }

  async function waiting() {
    expect(errors).toEqual([]);
    return database.owner.$queryRaw<BlockedQuery[]>`
      SELECT a.pid, a.datname, a.application_name, a.query, ${holder}::int AS holder
      FROM pg_stat_activity a JOIN pg_locks l ON l.pid = a.pid
      WHERE a.datname = ${database.name} AND a.application_name = ${marker}
        AND a.wait_event_type = 'Lock' AND l.locktype = 'advisory'
        AND NOT l.granted AND l.classid = ${namespace}::oid
        AND l.objid = ${key}::oid AND l.objsubid = 2
        AND ${holder} = ANY(pg_blocking_pids(a.pid))
    `;
  }
  async function release() {
    if (released) return;
    releaseRequested = true;
    const result = await client.query<{ unlocked: boolean }>(
      "SELECT pg_advisory_unlock($1, $2) unlocked",
      [namespace, key],
    );
    expect(result.rows).toEqual([{ unlocked: true }]);
    released = true;
  }
  return {
    identity: { database: database.name, namespace, key, marker, holder },
    get releaseRequested() {
      return releaseRequested;
    },
    async blockRead(userId: string, todoId: string) {
      const appRole = identifier(
        decodeURIComponent(new URL(database.connections.app).username),
      );
      await client.query(`
        CREATE SEQUENCE calendar_lifecycle.first_read;
        CREATE FUNCTION calendar_lifecycle.block_read(row_id text, owner_id text)
        RETURNS boolean LANGUAGE plpgsql VOLATILE
        SET search_path = pg_catalog AS $body$
        BEGIN
          IF row_id = ${literal(todoId)} AND owner_id = ${literal(userId)}
            AND current_setting('app.user_id', true) = ${literal(userId)} THEN
            IF nextval('calendar_lifecycle.first_read') = 1 THEN
              PERFORM set_config('application_name', ${literal(marker)}, true);
              PERFORM pg_advisory_xact_lock(${namespace}, ${key});
            END IF;
          END IF;
          RETURN true;
        END $body$;
        REVOKE ALL ON FUNCTION calendar_lifecycle.block_read(text, text) FROM PUBLIC;
        GRANT USAGE ON SCHEMA calendar_lifecycle TO ${appRole};
        GRANT USAGE ON SEQUENCE calendar_lifecycle.first_read TO ${appRole};
        GRANT EXECUTE ON FUNCTION calendar_lifecycle.block_read(text, text) TO ${appRole};
        CREATE POLICY calendar_lifecycle_read ON public."Todo"
          AS RESTRICTIVE FOR SELECT TO ${appRole}
          USING (calendar_lifecycle.block_read(id, "userId"));
      `);
    },
    async blockUsage(userId: string, clientId: string, grantId: string) {
      await client.query(`
        CREATE FUNCTION calendar_lifecycle.block_usage()
        RETURNS trigger LANGUAGE plpgsql
        SET search_path = pg_catalog AS $body$
        BEGIN
          IF NEW."userId" = ${literal(userId)}
            AND NEW."clientId" = ${literal(clientId)}
            AND NEW."grantId" = ${literal(grantId)}
            AND NEW.feature = 'workspace.calendar' THEN
            PERFORM set_config('application_name', ${literal(marker)}, true);
            PERFORM pg_advisory_xact_lock(${namespace}, ${key});
          END IF;
          RETURN NEW;
        END $body$;
        REVOKE ALL ON FUNCTION calendar_lifecycle.block_usage() FROM PUBLIC;
        CREATE TRIGGER calendar_lifecycle_usage BEFORE INSERT
          ON public."OAuthGrantUsageDaily" FOR EACH ROW
          EXECUTE FUNCTION calendar_lifecycle.block_usage();
      `);
    },
    async waitForBlocked(query: RegExp) {
      await expect
        .poll(async () => {
          const rows = await waiting();
          if (rows.length === 1) blocked = rows[0];
          return rows.length;
        })
        .toBe(1);
      if (!blocked) throw new Error("Missing blocked calendar backend");
      expect(blocked.query).toMatch(query);
      return blocked;
    },
    async assertStillBlocked() {
      if (!blocked) throw new Error("Calendar backend was never observed");
      expect(releaseRequested).toBe(false);
      expect(await waiting()).toEqual([blocked]);
      return blocked;
    },
    async assertBackendDisconnected() {
      if (!blocked) throw new Error("Calendar backend was never observed");
      expect(releaseRequested).toBe(true);
      expect(
        await database.owner.$queryRaw<{ pid: number }[]>`
          SELECT pid FROM pg_stat_activity
          WHERE datname = ${database.name} AND pid = ${blocked.pid}
        `,
      ).toEqual([]);
      expect(errors).toEqual([]);
    },
    release,
    async close() {
      try {
        await release();
      } finally {
        await client.end();
      }
    },
  };
}

export type CalendarLifecycleBarrier = Awaited<
  ReturnType<typeof calendarLifecycleBarrier>
>;
