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
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackupController = void 0;
const db_1 = require("../config/db");
const logger_1 = require("../config/logger");
const child_process_1 = require("child_process");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const WORKSPACE_DIR = path.resolve(__dirname, "../../../");
const DB_PATH = path.join(WORKSPACE_DIR, "database", "sme.db");
const BACKUPS_DIR = path.join(WORKSPACE_DIR, "backups");
class BackupController {
    static async getBackupHistory(req, res) {
        try {
            const history = await db_1.query.all("SELECT * FROM backups ORDER BY id DESC");
            res.json(history);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    static async createBackup(req, res) {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`; // Local YYYY-MM-DD
        const timeStr = now.toTimeString().substring(0, 8).replace(/:/g, ""); // HHMMSS
        const filename = `SME_Backup_${dateStr}_${timeStr}.zip`;
        const destPath = path.join(BACKUPS_DIR, filename);
        // Ensure backups directory exists
        if (!fs.existsSync(BACKUPS_DIR)) {
            fs.mkdirSync(BACKUPS_DIR, { recursive: true });
        }
        try {
            // Use Windows PowerShell to Compress-Archive
            // We first create a copy of the database to backup so we don't lock the active DB
            const tempCopyPath = path.join(BACKUPS_DIR, `sme_temp_${timeStr}.db`);
            fs.copyFileSync(DB_PATH, tempCopyPath);
            const command = `powershell.exe -Command "Compress-Archive -Path '${tempCopyPath}' -DestinationPath '${destPath}'"`;
            (0, child_process_1.exec)(command, async (err) => {
                // Always delete the temp database file
                if (fs.existsSync(tempCopyPath)) {
                    fs.unlinkSync(tempCopyPath);
                }
                const today = dateStr;
                const timeNow = now.toTimeString().substring(0, 8);
                if (err) {
                    console.error("Backup compression error:", err.message);
                    await db_1.query.run(`INSERT INTO backups (fecha, hora, ruta, tamano, automatico, usuario, resultado)
             VALUES (?, ?, ?, 0, ?, 'Administrador', 'FALLIDO')`, [today, timeNow, destPath, req.body.automatico ? 1 : 0]);
                    return res.status(500).json({ error: "Failed to compress backup: " + err.message });
                }
                const stats = fs.statSync(destPath);
                await db_1.query.run(`INSERT INTO backups (fecha, hora, ruta, tamano, automatico, usuario, resultado)
           VALUES (?, ?, ?, ?, ?, 'Administrador', 'EXITOSO')`, [today, timeNow, destPath, stats.size, req.body.automatico ? 1 : 0]);
                await (0, logger_1.logEvent)(logger_1.LogLevel.INFO, "Respaldos", "Creación", `Respaldo creado exitosamente: ${filename}`);
                res.json({ message: "Backup created successfully", filename, size: stats.size });
            });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    static async restoreBackup(req, res) {
        const backupId = req.params.id;
        try {
            const backup = await db_1.query.get("SELECT * FROM backups WHERE id = ?", [backupId]);
            if (!backup) {
                return res.status(404).json({ error: "Backup not found" });
            }
            if (!fs.existsSync(backup.ruta)) {
                return res.status(404).json({ error: `Backup zip file not found on disk at: ${backup.ruta}` });
            }
            // 1. Create a pre-restoration backup for safety
            const now = new Date();
            const timeStr = now.toTimeString().substring(0, 8).replace(/:/g, "");
            const safetyBackupName = `SME_SafetyBackup_BeforeRestore_${timeStr}.db`;
            const safetyBackupPath = path.join(BACKUPS_DIR, safetyBackupName);
            fs.copyFileSync(DB_PATH, safetyBackupPath);
            // 2. Unzip using PowerShell
            // We will unzip the sqlite database file from the zip to a temp location, then replace the database
            const tempExtractDir = path.join(BACKUPS_DIR, `temp_restore_${timeStr}`);
            fs.mkdirSync(tempExtractDir, { recursive: true });
            const command = `powershell.exe -Command "Expand-Archive -Path '${backup.ruta}' -DestinationPath '${tempExtractDir}' -Force"`;
            (0, child_process_1.exec)(command, async (err) => {
                if (err) {
                    if (fs.existsSync(tempExtractDir)) {
                        fs.rmSync(tempExtractDir, { recursive: true, force: true });
                    }
                    return res.status(500).json({ error: "Failed to extract backup zip: " + err.message });
                }
                // Find the extracted .db file inside temp folder
                const files = fs.readdirSync(tempExtractDir);
                const dbFile = files.find(f => f.endsWith(".db"));
                if (!dbFile) {
                    fs.rmSync(tempExtractDir, { recursive: true, force: true });
                    return res.status(400).json({ error: "Backup zip does not contain a valid database file" });
                }
                const extractedDbPath = path.join(tempExtractDir, dbFile);
                try {
                    // Verify SQLite database integrity before swapping
                    // We can try to open it with sqlite3 and check pragma integrity
                    const testDb = new (require("sqlite3").Database)(extractedDbPath);
                    testDb.get("PRAGMA integrity_check;", async (checkErr, row) => {
                        testDb.close();
                        if (checkErr || !row || row.integrity_check !== "ok") {
                            fs.rmSync(tempExtractDir, { recursive: true, force: true });
                            return res.status(400).json({ error: "Extracted database failed integrity check" });
                        }
                        // Close current db connection in api server
                        const { db: currentDb } = require("../config/db");
                        currentDb.close(async (closeErr) => {
                            if (closeErr) {
                                console.error("Error closing active DB connection:", closeErr);
                            }
                            try {
                                // Copy extracted DB over current DB
                                fs.copyFileSync(extractedDbPath, DB_PATH);
                                fs.rmSync(tempExtractDir, { recursive: true, force: true });
                                // Re-open DB connection
                                const newDb = new (require("sqlite3").Database)(DB_PATH, (reopenErr) => {
                                    if (reopenErr) {
                                        console.error("Error re-opening DB:", reopenErr);
                                    }
                                });
                                // Re-enable settings
                                newDb.serialize(() => {
                                    newDb.run("PRAGMA foreign_keys = ON;");
                                    newDb.run("PRAGMA journal_mode = WAL;");
                                    newDb.run("PRAGMA busy_timeout = 5000;");
                                });
                                // Update exports object in db config
                                const dbConfig = require("../config/db");
                                dbConfig.db = newDb;
                                await (0, logger_1.logEvent)(logger_1.LogLevel.CRITICAL, "Respaldos", "Restauración", `Base de datos restaurada desde el respaldo: ${path.basename(backup.ruta)}. Se generó respaldo de seguridad en ${safetyBackupName}`);
                                res.json({ message: "Backup restored successfully and database reloaded." });
                            }
                            catch (copyErr) {
                                // Fallback: Restore from safety backup
                                fs.copyFileSync(safetyBackupPath, DB_PATH);
                                res.status(500).json({ error: "Failed to overwrite active database: " + copyErr.message + ". Restored safety backup." });
                            }
                        });
                    });
                }
                catch (verErr) {
                    fs.rmSync(tempExtractDir, { recursive: true, force: true });
                    res.status(500).json({ error: "Verification of backup database failed: " + verErr.message });
                }
            });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}
exports.BackupController = BackupController;
