import { Request, Response } from "express";
import { query } from "../config/db";
import { logEvent, LogLevel } from "../config/logger";
import { exec } from "child_process";
import * as path from "path";
import * as fs from "fs";

const WORKSPACE_DIR = path.resolve(__dirname, "../../../");
const DB_PATH = path.join(WORKSPACE_DIR, "database", "sme.db");
const BACKUPS_DIR = path.join(WORKSPACE_DIR, "backups");

export class BackupController {
  static async getBackupHistory(req: Request, res: Response) {
    try {
      const history = await query.all("SELECT * FROM backups ORDER BY id DESC");
      res.json(history);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async createBackup(req: Request, res: Response) {
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
      
      exec(command, async (err) => {
        // Always delete the temp database file
        if (fs.existsSync(tempCopyPath)) {
          fs.unlinkSync(tempCopyPath);
        }

        const today = dateStr;
        const timeNow = now.toTimeString().substring(0, 8);

        if (err) {
          console.error("Backup compression error:", err.message);
          await query.run(
            `INSERT INTO backups (fecha, hora, ruta, tamano, automatico, usuario, resultado)
             VALUES (?, ?, ?, 0, ?, 'Administrador', 'FALLIDO')`,
            [today, timeNow, destPath, req.body.automatico ? 1 : 0]
          );
          return res.status(500).json({ error: "Failed to compress backup: " + err.message });
        }

        const stats = fs.statSync(destPath);
        await query.run(
          `INSERT INTO backups (fecha, hora, ruta, tamano, automatico, usuario, resultado)
           VALUES (?, ?, ?, ?, ?, 'Administrador', 'EXITOSO')`,
          [today, timeNow, destPath, stats.size, req.body.automatico ? 1 : 0]
        );

        await logEvent(
          LogLevel.INFO,
          "Respaldos",
          "Creación",
          `Respaldo creado exitosamente: ${filename}`
        );

        res.json({ message: "Backup created successfully", filename, size: stats.size });
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async restoreBackup(req: Request, res: Response) {
    const backupId = req.params.id;
    try {
      const backup = await query.get<any>("SELECT * FROM backups WHERE id = ?", [backupId]);
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
      
      exec(command, async (err) => {
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
          testDb.get("PRAGMA integrity_check;", async (checkErr: any, row: any) => {
            testDb.close();
            if (checkErr || !row || row.integrity_check !== "ok") {
              fs.rmSync(tempExtractDir, { recursive: true, force: true });
              return res.status(400).json({ error: "Extracted database failed integrity check" });
            }

            // Close current db connection in api server
            const { db: currentDb } = require("../config/db");
            currentDb.close(async (closeErr: any) => {
              if (closeErr) {
                console.error("Error closing active DB connection:", closeErr);
              }

              try {
                // Copy extracted DB over current DB
                fs.copyFileSync(extractedDbPath, DB_PATH);
                fs.rmSync(tempExtractDir, { recursive: true, force: true });

                // Re-open DB connection
                const newDb = new (require("sqlite3").Database)(DB_PATH, (reopenErr: any) => {
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

                await logEvent(
                  LogLevel.CRITICAL,
                  "Respaldos",
                  "Restauración",
                  `Base de datos restaurada desde el respaldo: ${path.basename(backup.ruta)}. Se generó respaldo de seguridad en ${safetyBackupName}`
                );

                res.json({ message: "Backup restored successfully and database reloaded." });
              } catch (copyErr: any) {
                // Fallback: Restore from safety backup
                fs.copyFileSync(safetyBackupPath, DB_PATH);
                res.status(500).json({ error: "Failed to overwrite active database: " + copyErr.message + ". Restored safety backup." });
              }
            });
          });
        } catch (verErr: any) {
          fs.rmSync(tempExtractDir, { recursive: true, force: true });
          res.status(500).json({ error: "Verification of backup database failed: " + verErr.message });
        }
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
