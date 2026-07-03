"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsController = void 0;
const db_1 = require("../config/db");
const logger_1 = require("../config/logger");
const shared_1 = require("shared");
class SettingsController {
    static async getSettings(req, res) {
        try {
            const settings = await db_1.query.get("SELECT * FROM settings WHERE id = 1");
            if (!settings) {
                return res.status(404).json({ error: "Configuration not found" });
            }
            res.json(settings);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    static async updateSettings(req, res) {
        try {
            const parsed = shared_1.SettingsSchema.safeParse(req.body);
            if (!parsed.success) {
                return res.status(400).json({ error: "Invalid data", details: parsed.error.format() });
            }
            const { intervaloPing, fallosConsecutivos, recuperacionesConsecutivas, timeout, rutaRespaldos, rutaExportaciones, nombreInstitucion, logo, actualizacionAutomatica } = parsed.data;
            await db_1.query.run(`UPDATE settings SET 
          intervaloPing = ?, 
          fallosConsecutivos = ?, 
          recuperacionesConsecutivas = ?, 
          timeout = ?, 
          rutaRespaldos = ?, 
          rutaExportaciones = ?, 
          nombreInstitucion = ?, 
          logo = ?, 
          actualizacionAutomatica = ?
         WHERE id = 1`, [
                intervaloPing,
                fallosConsecutivos,
                recuperacionesConsecutivas,
                timeout,
                rutaRespaldos,
                rutaExportaciones,
                nombreInstitucion,
                logo,
                actualizacionAutomatica ? 1 : 0
            ]);
            await (0, logger_1.logEvent)(logger_1.LogLevel.INFO, "Configuración", "Modificación", "Configuración del sistema actualizada desde la interfaz de usuario.");
            res.json({ message: "Configuration updated successfully" });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}
exports.SettingsController = SettingsController;
