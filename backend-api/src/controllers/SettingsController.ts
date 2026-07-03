import { Request, Response } from "express";
import { query } from "../config/db";
import { logEvent, LogLevel } from "../config/logger";
import { SettingsSchema } from "shared";

export class SettingsController {
  static async getSettings(req: Request, res: Response) {
    try {
      const settings = await query.get("SELECT * FROM settings WHERE id = 1");
      if (!settings) {
        return res.status(404).json({ error: "Configuration not found" });
      }
      res.json(settings);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async updateSettings(req: Request, res: Response) {
    try {
      const parsed = SettingsSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid data", details: parsed.error.format() });
      }

      const {
        intervaloPing,
        fallosConsecutivos,
        recuperacionesConsecutivas,
        timeout,
        rutaRespaldos,
        rutaExportaciones,
        nombreInstitucion,
        logo,
        actualizacionAutomatica
      } = parsed.data;

      await query.run(
        `UPDATE settings SET 
          intervaloPing = ?, 
          fallosConsecutivos = ?, 
          recuperacionesConsecutivas = ?, 
          timeout = ?, 
          rutaRespaldos = ?, 
          rutaExportaciones = ?, 
          nombreInstitucion = ?, 
          logo = ?, 
          actualizacionAutomatica = ?
         WHERE id = 1`,
        [
          intervaloPing,
          fallosConsecutivos,
          recuperacionesConsecutivas,
          timeout,
          rutaRespaldos,
          rutaExportaciones,
          nombreInstitucion,
          logo,
          actualizacionAutomatica ? 1 : 0
        ]
      );

      await logEvent(
        LogLevel.INFO,
        "Configuración",
        "Modificación",
        "Configuración del sistema actualizada desde la interfaz de usuario."
      );

      res.json({ message: "Configuration updated successfully" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
