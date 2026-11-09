// Test-only D1 stand-in backed by Node's built-in SQLite, loaded with the real migrations.
import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

type Params = Array<string | number | null>;
class Statement {
  constructor(private db: DatabaseSync, private sql: string, private params: Params = []) {}
  bind(...params: Params) { return new Statement(this.db, this.sql, params); }
  async first<T>() { return (this.db.prepare(this.sql).get(...this.params) as T | undefined) ?? null; }
  async all<T>() { return { results: this.db.prepare(this.sql).all(...this.params) as T[] }; }
  async run() { return this.runSync(); }
  runSync() { return { meta: { changes: Number(this.db.prepare(this.sql).run(...this.params).changes) } }; }
}

export function createTestDatabase() {
  const db = new DatabaseSync(":memory:");
  for (const file of readdirSync("drizzle").filter((name) => name.endsWith(".sql")).sort()) db.exec(readFileSync(`drizzle/${file}`, "utf8"));
  const d1 = {
    prepare: (sql: string) => new Statement(db, sql),
    async batch(statements: Statement[]) {
      db.exec("BEGIN");
      try { const results = statements.map((statement) => statement.runSync()); db.exec("COMMIT"); return results; }
      catch (error) { db.exec("ROLLBACK"); throw error; }
    },
  };
  return { db, d1 };
}
