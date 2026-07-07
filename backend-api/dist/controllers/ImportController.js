"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImportController = void 0;
const db_1 = require("../config/db");
const logger_1 = require("../config/logger");
const shared_1 = require("shared");
class ImportController {
    static async getImportHistory(req, res) {
        try {
            const history = await db_1.query.all("SELECT * FROM imports ORDER BY id DESC");
            res.json(history);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    static async importCatalogs(req, res) {
        const startTime = Date.now();
        const type = req.query.type || "all"; // 'cities', 'units', 'rooms', 'all'
        const payload = req.body;
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const today = `${year}-${month}-${day}`;
        const timeNow = now.toTimeString().substring(0, 8);
        const nowISO = now.toISOString();
        if (!Array.isArray(payload)) {
            return res.status(400).json({ error: "Payload must be a JSON array" });
        }
        try {
            const result = await db_1.query.transaction(async () => {
                let inserted = 0;
                let updated = 0;
                let deactivated = 0;
                const errors = [];
                if (type === "cities") {
                    for (let i = 0; i < payload.length; i++) {
                        const parsed = shared_1.CitySchema.safeParse(payload[i]);
                        if (!parsed.success) {
                            errors.push(`Record ${i}: ${JSON.stringify(parsed.error.format())}`);
                            continue;
                        }
                        const { id, nombre } = parsed.data;
                        const existing = await db_1.query.get("SELECT id FROM cities WHERE id = ?", [id]);
                        if (existing) {
                            await db_1.query.run("UPDATE cities SET nombre = ? WHERE id = ?", [nombre, id]);
                            updated++;
                        }
                        else {
                            await db_1.query.run("INSERT INTO cities (id, nombre) VALUES (?, ?)", [id, nombre]);
                            inserted++;
                        }
                    }
                }
                else if (type === "units") {
                    // Validate and import units
                    for (let i = 0; i < payload.length; i++) {
                        const parsed = shared_1.UnitSchema.safeParse(payload[i]);
                        if (!parsed.success) {
                            errors.push(`Record ${i}: ${JSON.stringify(parsed.error.format())}`);
                            continue;
                        }
                        const { id, nombre, cityId, tipo, activo } = parsed.data;
                        // Check if city exists
                        const cityExists = await db_1.query.get("SELECT id FROM cities WHERE id = ?", [cityId]);
                        if (!cityExists) {
                            errors.push(`Record ${i}: Referenced City ID "${cityId}" does not exist in catalog.`);
                            continue;
                        }
                        const existing = await db_1.query.get("SELECT id, activo FROM units WHERE id = ?", [id]);
                        if (existing) {
                            await db_1.query.run(`UPDATE units SET nombre = ?, cityId = ?, tipo = ?, activo = ?, ultimaActualizacion = ? WHERE id = ?`, [nombre, cityId, tipo, activo ? 1 : 0, nowISO, id]);
                            updated++;
                            if (existing.activo === 1 && !activo) {
                                deactivated++;
                            }
                        }
                        else {
                            await db_1.query.run(`INSERT INTO units (id, nombre, cityId, tipo, activo, fechaImportacion, ultimaActualizacion) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`, [id, nombre, cityId, tipo, activo ? 1 : 0, nowISO, nowISO]);
                            inserted++;
                        }
                    }
                }
                else if (type === "rooms") {
                    // Validate and import rooms
                    for (let i = 0; i < payload.length; i++) {
                        const parsed = shared_1.RawRoomImportSchema.safeParse(payload[i]);
                        if (!parsed.success) {
                            errors.push(`Record ${i}: ${JSON.stringify(parsed.error.format())}`);
                            continue;
                        }
                        const rawRoom = parsed.data;
                        const unitId = rawRoom.unidadId || rawRoom.unitId;
                        // Check if unit exists
                        const unitExists = await db_1.query.get("SELECT id FROM units WHERE id = ?", [unitId]);
                        if (!unitExists) {
                            errors.push(`Record ${i}: Referenced Unit ID "${unitId}" does not exist in catalog.`);
                            continue;
                        }
                        // Compose a deterministic ID or check for existing by unit + name
                        const existing = await db_1.query.get("SELECT id FROM rooms WHERE unitId = ? AND nombre = ?", [unitId, rawRoom.nombre]);
                        if (existing) {
                            await db_1.query.run(`UPDATE rooms SET ultimaActualizacion = ? WHERE id = ?`, [nowISO, existing.id]);
                            updated++;
                        }
                        else {
                            const roomId = `R-${unitId}-${Math.floor(Math.random() * 1000000)}`;
                            await db_1.query.run(`INSERT INTO rooms (id, unitId, nombre, fechaImportacion, ultimaActualizacion) 
                 VALUES (?, ?, ?, ?, ?)`, [roomId, unitId, rawRoom.nombre, nowISO, nowISO]);
                            inserted++;
                        }
                    }
                }
                else {
                    throw new Error(`Unsupported import type: ${type}`);
                }
                if (errors.length > 0) {
                    throw new Error(`Import validation failed:\n${errors.join("\n")}`);
                }
                const duration = Date.now() - startTime;
                const totalProcessed = inserted + updated;
                // Log import log row
                await db_1.query.run(`INSERT INTO imports (tipoArchivo, fecha, hora, usuario, registrosImportados, errores, duracion, resultado, archivoOriginal)
           VALUES (?, ?, ?, 'Administrador', ?, null, ?, 'EXITOSO', ?)`, [type, today, timeNow, totalProcessed, duration, `import_${type}_${today}.json`]);
                await (0, logger_1.logEvent)(logger_1.LogLevel.INFO, "Importación", "Catálogo", `Importación de ${type} completada: ${inserted} creados, ${updated} actualizados.`);
                return { inserted, updated, deactivated };
            });
            res.json({
                message: "Import completed successfully",
                details: result
            });
        }
        catch (error) {
            const duration = Date.now() - startTime;
            // Log failed import attempt
            try {
                await db_1.query.run(`INSERT INTO imports (tipoArchivo, fecha, hora, usuario, registrosImportados, errores, duracion, resultado, archivoOriginal)
           VALUES (?, ?, ?, 'Administrador', 0, ?, ?, 'FALLIDO', ?)`, [type, today, timeNow, error.message, duration, `failed_import_${type}_${today}.json`]);
                await (0, logger_1.logEvent)(logger_1.LogLevel.ERROR, "Importación", "Falla", `Falla en importación de catálogo ${type}: ${error.message}`);
            }
            catch (logErr) {
                console.error("Failed to persist failed import details:", logErr);
            }
            res.status(400).json({
                error: "Import failed",
                details: error.message
            });
        }
    }
}
exports.ImportController = ImportController;
