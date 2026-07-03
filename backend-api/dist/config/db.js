"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.query = exports.db = void 0;
const path = __importStar(require("path"));
const sqlite3_1 = __importDefault(require("sqlite3"));
const fs = __importStar(require("fs"));
const DB_PATH = path.resolve(__dirname, "../../../database/sme.db");
// Ensure the directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}
console.log(`Connecting to SQLite database at: ${DB_PATH}`);
exports.db = new sqlite3_1.default.Database(DB_PATH, (err) => {
    if (err) {
        console.error("Failed to connect to SQLite database:", err.message);
    }
    else {
        // Configure settings for concurrent access
        exports.db.serialize(() => {
            exports.db.run("PRAGMA foreign_keys = ON;");
            exports.db.run("PRAGMA journal_mode = WAL;");
            exports.db.run("PRAGMA busy_timeout = 5000;");
        });
        console.log("Connected to SQLite database successfully (WAL enabled).");
    }
});
// Helper for DB query operations wrapped in Promises
exports.query = {
    all: (sql, params = []) => {
        return new Promise((resolve, reject) => {
            exports.db.all(sql, params, (err, rows) => {
                if (err)
                    reject(err);
                else
                    resolve(rows);
            });
        });
    },
    get: (sql, params = []) => {
        return new Promise((resolve, reject) => {
            exports.db.get(sql, params, (err, row) => {
                if (err)
                    reject(err);
                else
                    resolve((row || null));
            });
        });
    },
    run: (sql, params = []) => {
        return new Promise((resolve, reject) => {
            exports.db.run(sql, params, function (err) {
                if (err)
                    reject(err);
                else
                    resolve({ lastID: this.lastID, changes: this.changes });
            });
        });
    },
    exec: (sql) => {
        return new Promise((resolve, reject) => {
            exports.db.exec(sql, (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    },
    transaction: async (callback) => {
        await new Promise((resolve, reject) => {
            exports.db.run("BEGIN TRANSACTION;", (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
        try {
            const result = await callback();
            await new Promise((resolve, reject) => {
                exports.db.run("COMMIT;", (err) => {
                    if (err)
                        reject(err);
                    else
                        resolve();
                });
            });
            return result;
        }
        catch (error) {
            await new Promise((resolve, reject) => {
                exports.db.run("ROLLBACK;", (err) => {
                    if (err)
                        reject(err);
                    else
                        resolve();
                });
            });
            throw error;
        }
    }
};
