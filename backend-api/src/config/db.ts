import * as path from "path";
import sqlite3 from "sqlite3";
import * as fs from "fs";

const DB_PATH = path.resolve(__dirname, "../../../database/sme.db");

// Ensure the directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

console.log(`Connecting to SQLite database at: ${DB_PATH}`);

export const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error("Failed to connect to SQLite database:", err.message);
  } else {
    // Configure settings for concurrent access
    db.serialize(() => {
      db.run("PRAGMA foreign_keys = ON;");
      db.run("PRAGMA journal_mode = WAL;");
      db.run("PRAGMA busy_timeout = 5000;");
    });
    console.log("Connected to SQLite database successfully (WAL enabled).");
  }
});

// Helper for DB query operations wrapped in Promises
export const query = {
  all: <T>(sql: string, params: any[] = []): Promise<T[]> => {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows as T[]);
      });
    });
  },
  
  get: <T>(sql: string, params: any[] = []): Promise<T | null> => {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve((row || null) as T | null);
      });
    });
  },
  
  run: (sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> => {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  },

  exec: (sql: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      db.exec(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  },

  transaction: async <T>(callback: () => Promise<T>): Promise<T> => {
    await new Promise<void>((resolve, reject) => {
      db.run("BEGIN TRANSACTION;", (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    try {
      const result = await callback();
      await new Promise<void>((resolve, reject) => {
        db.run("COMMIT;", (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      return result;
    } catch (error) {
      await new Promise<void>((resolve, reject) => {
        db.run("ROLLBACK;", (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      throw error;
    }
  }
};
