declare module "bun:sqlite" {
  export interface DatabaseOptions {
    readonly?: boolean;
    create?: boolean;
    readwrite?: boolean;
  }

  export interface Statement {
    all(...params: unknown[]): unknown[];
    get(...params: unknown[]): unknown;
    run(...params: unknown[]): { changes: number; lastInsertRowid: number };
  }

  export class Database {
    constructor(path: string, options?: DatabaseOptions);
    query(sql: string): Statement;
    prepare(sql: string): Statement;
    run(
      sql: string,
      ...params: unknown[]
    ): { changes: number; lastInsertRowid: number };
    close(): void;
  }
}
