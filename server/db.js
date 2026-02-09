import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const DB_PATH = path.join(process.cwd(), "server", "signage.sqlite");
const SCHEMA_PATH = path.join(process.cwd(), "server", "schema.sql");

export const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

export function initDb() {
  const schema = fs.readFileSync(SCHEMA_PATH, "utf-8");
  db.exec(schema);
}
