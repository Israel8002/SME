"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnitController = void 0;
const db_1 = require("../config/db");
const logger_1 = require("../config/logger");
const shared_1 = require("shared");
const catalogSync_1 = require("../utils/catalogSync");
class UnitController {
    static async getUnits(req, res) {
        try {
            const search = req.query.search ? `%${req.query.search}%` : "%";
            const cityId = req.query.cityId || "";
            const tipo = req.query.tipo || "";
            const state = req.query.state || ""; // Operativa, Con Incidencia, Deshabilitada, etc.
            const hasTicket = req.query.hasTicket || ""; // yes, no
            const sortColumn = req.query.sortColumn || "id";
            const sortOrder = req.query.sortOrder === "desc" ? "DESC" : "ASC";
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const offset = (page - 1) * limit;
            // Base query to fetch units with metadata
            let sql = `
        SELECT 
          u.id, 
          u.nombre, 
          u.cityId, 
          c.nombre AS ciudadNombre,
          u.tipo, 
          u.activo,
          (SELECT COUNT(*) FROM unit_ips WHERE unitId = u.id) AS ipsConfiguradas,
          (SELECT COUNT(*) FROM unit_ips WHERE unitId = u.id AND esCritica = 1) AS ipsCriticas,
          (SELECT folio FROM tickets WHERE unitId = u.id AND estado = 'Abierto' ORDER BY id DESC LIMIT 1) AS ticketActivo,
          (SELECT MAX(fechaInicio || ' ' || horaInicio) FROM tickets WHERE unitId = u.id) AS ultimaCaida,
          (SELECT MAX(fechaFin || ' ' || horaFin) FROM tickets WHERE unitId = u.id AND estado = 'Cerrado') AS ultimaRecuperacion
        FROM units u
        JOIN cities c ON u.cityId = c.id
        WHERE (u.nombre LIKE ? OR u.id LIKE ? OR c.nombre LIKE ? OR u.tipo LIKE ?)
      `;
            const params = [search, search, search, search];
            if (cityId) {
                sql += " AND u.cityId = ?";
                params.push(cityId);
            }
            if (tipo) {
                sql += " AND u.tipo = ?";
                params.push(tipo);
            }
            if (req.query.activo !== undefined) {
                sql += " AND u.activo = ?";
                params.push(req.query.activo === "true" ? 1 : 0);
            }
            // Add state and ticket filters after fetching or in subqueries.
            // Let's implement filters directly in SQL where possible, or process them in JS if complex.
            // To filter by ticketActivo (hasTicket)
            if (hasTicket === "yes") {
                sql += " AND EXISTS (SELECT 1 FROM tickets WHERE unitId = u.id AND estado = 'Abierto')";
            }
            else if (hasTicket === "no") {
                sql += " AND NOT EXISTS (SELECT 1 FROM tickets WHERE unitId = u.id AND estado = 'Abierto')";
            }
            // Sorting (Sanitize column name to avoid SQL Injection)
            const allowedColumns = ["id", "nombre", "cityId", "tipo", "activo", "ipsConfiguradas", "ipsCriticas", "ultimaCaida", "ultimaRecuperacion"];
            const actualSortColumn = allowedColumns.includes(sortColumn) ? sortColumn : "id";
            const columnMapping = {
                id: "u.id",
                nombre: "u.nombre",
                cityId: "u.cityId",
                tipo: "u.tipo",
                activo: "u.activo",
                ipsConfiguradas: "ipsConfiguradas",
                ipsCriticas: "ipsCriticas",
                ultimaCaida: "ultimaCaida",
                ultimaRecuperacion: "ultimaRecuperacion"
            };
            const sortColumnMapped = columnMapping[actualSortColumn] || "u.id";
            sql += ` ORDER BY ${sortColumnMapped} ${sortOrder}`;
            // Get total count first for pagination metadata
            const countSql = `SELECT COUNT(*) as total FROM (${sql})`;
            const totalRow = await db_1.query.get(countSql, params);
            const total = totalRow ? totalRow.total : 0;
            // Add pagination
            sql += " LIMIT ? OFFSET ?";
            params.push(limit, offset);
            const rows = await db_1.query.all(sql, params);
            // Post-process units to add dynamic state & availability metrics
            const unitsWithMetrics = await Promise.all(rows.map(async (unit) => {
                // Calculate State
                let calculatedState = "Operativa";
                if (unit.activo === 0) {
                    calculatedState = "Deshabilitada";
                }
                else if (unit.ticketActivo) {
                    calculatedState = "Con Incidencia";
                }
                else if (unit.ipsConfiguradas === 0) {
                    calculatedState = "Monitoreando"; // No IPs configured, idle
                }
                else {
                    // Check if any IP was checked recently. If not, state is "Monitoreando"
                    calculatedState = "Operativa";
                }
                // Calculate Monthly Availability
                // Formula: Percentage of time in the current month without open/closed tickets
                const availability = await calculateAvailability(unit.id);
                return {
                    ...unit,
                    estado: calculatedState,
                    disponibilidad: availability
                };
            }));
            // Filter by state in memory if state filter is applied
            let filteredResult = unitsWithMetrics;
            if (state) {
                filteredResult = unitsWithMetrics.filter(u => u.estado.toLowerCase() === state.toLowerCase());
            }
            res.json({
                data: filteredResult,
                pagination: {
                    total,
                    page,
                    limit,
                    totalPages: Math.ceil(total / limit)
                }
            });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    static async getUnitDetail(req, res) {
        try {
            const unitId = req.params.id;
            const unit = await db_1.query.get(`SELECT u.*, c.nombre AS ciudadNombre 
         FROM units u 
         JOIN cities c ON u.cityId = c.id 
         WHERE u.id = ?`, [unitId]);
            if (!unit) {
                return res.status(404).json({ error: "Unit not found" });
            }
            // Fetch Rooms
            const rooms = await db_1.query.all("SELECT * FROM rooms WHERE unitId = ?", [unitId]);
            // Fetch IPs
            const ips = await db_1.query.all("SELECT * FROM unit_ips WHERE unitId = ?", [unitId]);
            // Fetch Recent Tickets (limit 10)
            const tickets = await db_1.query.all("SELECT * FROM tickets WHERE unitId = ? ORDER BY id DESC LIMIT 10", [unitId]);
            // Fetch availability
            const disponibilidad = await calculateAvailability(unit.id);
            // Calculate unit state
            let calculatedState = "Operativa";
            const hasActiveTicket = tickets.some((t) => t.estado === "Abierto");
            if (unit.activo === 0) {
                calculatedState = "Deshabilitada";
            }
            else if (hasActiveTicket) {
                calculatedState = "Con Incidencia";
            }
            else if (ips.length === 0) {
                calculatedState = "Monitoreando";
            }
            res.json({
                ...unit,
                estado: calculatedState,
                disponibilidad,
                rooms,
                ips,
                tickets
            });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    // --- IP Configuration Endpoints ---
    static async getUnitIps(req, res) {
        try {
            const unitId = req.params.id;
            const ips = await db_1.query.all("SELECT * FROM unit_ips WHERE unitId = ? ORDER BY id DESC", [unitId]);
            res.json(ips);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    static async createUnitIp(req, res) {
        try {
            const unitId = parseInt(req.params.id);
            const parsed = shared_1.UnitIPSchema.safeParse({ ...req.body, unitId });
            if (!parsed.success) {
                return res.status(400).json({ error: "Invalid IP configuration", details: parsed.error.format() });
            }
            const { direccionIP, descripcion, esCritica, activa, timeout, intervaloPing } = parsed.data;
            // Duplicate validation
            const existing = await db_1.query.get("SELECT id FROM unit_ips WHERE unitId = ? AND direccionIP = ?", [unitId, direccionIP]);
            if (existing) {
                return res.status(400).json({ error: "IP address already configured for this unit" });
            }
            const now = new Date().toISOString();
            const result = await db_1.query.run(`INSERT INTO unit_ips (unitId, direccionIP, descripcion, esCritica, activa, timeout, intervaloPing, fechaAlta, ultimaModificacion)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                unitId,
                direccionIP,
                descripcion,
                esCritica ? 1 : 0,
                activa ? 1 : 0,
                timeout,
                intervaloPing,
                now,
                now
            ]);
            await (0, logger_1.logEvent)(logger_1.LogLevel.INFO, "Unidades", "Alta IP", `IP ${direccionIP} agregada a la unidad con ID ${unitId}.`);
            res.status(201).json({ id: result.lastID, message: "IP created successfully" });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    static async updateUnitIp(req, res) {
        try {
            const unitId = parseInt(req.params.id);
            const ipId = parseInt(req.params.ipId);
            const parsed = shared_1.UnitIPSchema.safeParse({ ...req.body, unitId });
            if (!parsed.success) {
                return res.status(400).json({ error: "Invalid IP configuration", details: parsed.error.format() });
            }
            const { direccionIP, descripcion, esCritica, activa, timeout, intervaloPing } = parsed.data;
            // Duplicate validation excluding current
            const existing = await db_1.query.get("SELECT id FROM unit_ips WHERE unitId = ? AND direccionIP = ? AND id <> ?", [unitId, direccionIP, ipId]);
            if (existing) {
                return res.status(400).json({ error: "Another IP is already configured with this address" });
            }
            const now = new Date().toISOString();
            await db_1.query.run(`UPDATE unit_ips SET 
          direccionIP = ?, 
          descripcion = ?, 
          esCritica = ?, 
          activa = ?, 
          timeout = ?, 
          intervaloPing = ?, 
          ultimaModificacion = ?
         WHERE id = ? AND unitId = ?`, [
                direccionIP,
                descripcion,
                esCritica ? 1 : 0,
                activa ? 1 : 0,
                timeout,
                intervaloPing,
                now,
                ipId,
                unitId
            ]);
            await (0, logger_1.logEvent)(logger_1.LogLevel.INFO, "Unidades", "Modificación IP", `IP ${direccionIP} en unidad ${unitId} actualizada.`);
            res.json({ message: "IP updated successfully" });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    static async deleteUnitIp(req, res) {
        try {
            const unitId = parseInt(req.params.id);
            const ipId = parseInt(req.params.ipId);
            const ipInfo = await db_1.query.get("SELECT direccionIP FROM unit_ips WHERE id = ? AND unitId = ?", [ipId, unitId]);
            if (!ipInfo) {
                return res.status(404).json({ error: "IP not found" });
            }
            await db_1.query.run("DELETE FROM unit_ips WHERE id = ? AND unitId = ?", [ipId, unitId]);
            await (0, logger_1.logEvent)(logger_1.LogLevel.WARNING, "Unidades", "Baja IP", `IP ${ipInfo.direccionIP} eliminada de la unidad ${unitId}.`);
            res.json({ message: "IP deleted successfully" });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    static async updateUnit(req, res) {
        try {
            const id = parseInt(req.params.id);
            const { nombre, activo, motivoPausa } = req.body;
            const unit = await db_1.query.get("SELECT id, nombre, activo FROM units WHERE id = ?", [id]);
            if (!unit) {
                return res.status(404).json({ error: "Unit not found" });
            }
            const now = new Date().toISOString();
            await db_1.query.transaction(async () => {
                if (nombre !== undefined && nombre.trim() !== "") {
                    await db_1.query.run(`UPDATE units SET nombre = ?, ultimaActualizacion = ? WHERE id = ?`, [nombre.trim(), now, id]);
                    await (0, logger_1.logEvent)(logger_1.LogLevel.INFO, "Unidades", "Modificación Nombre", `Nombre de la unidad ID ${id} cambiado de "${unit.nombre}" a "${nombre.trim()}".`);
                }
                if (activo !== undefined) {
                    const finalMotivo = activo ? null : (motivoPausa ? String(motivoPausa).trim() : "Sin motivo especificado");
                    await db_1.query.run(`UPDATE units SET activo = ?, motivoPausa = ?, ultimaActualizacion = ? WHERE id = ?`, [activo ? 1 : 0, finalMotivo, now, id]);
                    if (!activo) {
                        await db_1.query.run(`DELETE FROM ticket_details WHERE ticketId IN (SELECT id FROM tickets WHERE unitId = ?)`, [id]);
                        await db_1.query.run(`DELETE FROM tickets WHERE unitId = ?`, [id]);
                    }
                    const action = activo ? "Reanudación" : "Pausa";
                    const reasonDetail = !activo ? ` Motivo: ${finalMotivo}` : "";
                    await (0, logger_1.logEvent)(logger_1.LogLevel.WARNING, "Unidades", `Monitoreo ${action}`, `Monitoreo de la unidad ${nombre || unit.nombre} (ID ${id}) ha sido ${activo ? "reanudado" : "pausado"}.${reasonDetail}`);
                }
            });
            await (0, catalogSync_1.syncCatalogs)();
            res.json({ message: "Unit updated successfully" });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    static async deleteUnit(req, res) {
        try {
            const id = parseInt(req.params.id);
            const unit = await db_1.query.get("SELECT id, nombre FROM units WHERE id = ?", [id]);
            if (!unit) {
                return res.status(404).json({ error: "Unit not found" });
            }
            await db_1.query.transaction(async () => {
                // 1. Delete ticket details associated with this unit's tickets
                await db_1.query.run(`DELETE FROM ticket_details WHERE ticketId IN (SELECT id FROM tickets WHERE unitId = ?)`, [id]);
                // 2. Delete tickets associated with this unit
                await db_1.query.run(`DELETE FROM tickets WHERE unitId = ?`, [id]);
                // 3. Delete the unit itself (cascade deletes rooms and unit_ips automatically)
                await db_1.query.run(`DELETE FROM units WHERE id = ?`, [id]);
            });
            await (0, logger_1.logEvent)(logger_1.LogLevel.WARNING, "Unidades", "Baja Unidad", `Unidad ${unit.nombre} (ID ${id}) eliminada permanentemente del sistema.`);
            await (0, catalogSync_1.syncCatalogs)();
            res.json({ message: "Unit deleted successfully" });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    static async createUnit(req, res) {
        try {
            const { id, nombre, cityId, tipo } = req.body;
            if (!id || !nombre || !cityId || !tipo) {
                return res.status(400).json({ error: "Missing required fields: id, nombre, cityId, tipo" });
            }
            const unitId = parseInt(id);
            if (isNaN(unitId) || unitId <= 0) {
                return res.status(400).json({ error: "Official ID must be a positive integer" });
            }
            const existing = await db_1.query.get("SELECT id FROM units WHERE id = ?", [unitId]);
            if (existing) {
                return res.status(400).json({ error: `A unit with Official ID ${unitId} already exists` });
            }
            const now = new Date().toISOString();
            await db_1.query.run(`INSERT INTO units (id, nombre, cityId, tipo, activo, fechaImportacion, ultimaActualizacion)
         VALUES (?, ?, ?, ?, 1, ?, ?)`, [unitId, nombre.trim(), cityId, tipo, now, now]);
            await (0, logger_1.logEvent)(logger_1.LogLevel.INFO, "Unidades", "Alta Unidad", `Unidad ${nombre} (ID ${unitId}) registrada manualmente.`);
            await (0, catalogSync_1.syncCatalogs)();
            res.status(201).json({ message: "Unit created successfully", unitId });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    static async createRoom(req, res) {
        try {
            const unitId = parseInt(req.params.id);
            const { nombre } = req.body;
            if (!nombre || !nombre.trim()) {
                return res.status(400).json({ error: "Missing required 'nombre' field in request body" });
            }
            const unit = await db_1.query.get("SELECT id, nombre FROM units WHERE id = ?", [unitId]);
            if (!unit) {
                return res.status(404).json({ error: "Unit not found" });
            }
            const existing = await db_1.query.get("SELECT id FROM rooms WHERE unitId = ? AND nombre = ?", [unitId, nombre.trim()]);
            if (existing) {
                return res.status(400).json({ error: `Room "${nombre.trim()}" already exists for this unit` });
            }
            const countRes = await db_1.query.get("SELECT COUNT(*) as count FROM rooms WHERE unitId = ?", [unitId]);
            const nextIndex = (countRes?.count || 0) + 1;
            const roomId = `R-${unitId}-${nextIndex}-${Date.now().toString().slice(-4)}`;
            const now = new Date().toISOString();
            await db_1.query.run(`INSERT INTO rooms (id, unitId, nombre, fechaImportacion, ultimaActualizacion) VALUES (?, ?, ?, ?, ?)`, [roomId, unitId, nombre.trim(), now, now]);
            await (0, logger_1.logEvent)(logger_1.LogLevel.INFO, "Unidades", "Alta Cuarto", `Cuarto de enlace "${nombre.trim()}" (ID ${roomId}) agregado a la unidad "${unit.nombre}" (ID ${unitId}).`);
            await (0, catalogSync_1.syncCatalogs)();
            res.status(201).json({ message: "Room added successfully", roomId });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    static async deleteRoom(req, res) {
        try {
            const unitId = parseInt(req.params.id);
            const roomId = req.params.roomId;
            const room = await db_1.query.get("SELECT nombre FROM rooms WHERE id = ? AND unitId = ?", [roomId, unitId]);
            if (!room) {
                return res.status(404).json({ error: "Room not found" });
            }
            await db_1.query.run("DELETE FROM rooms WHERE id = ? AND unitId = ?", [roomId, unitId]);
            await (0, logger_1.logEvent)(logger_1.LogLevel.WARNING, "Unidades", "Baja Cuarto", `Cuarto de enlace "${room.nombre}" (ID ${roomId}) eliminado de la unidad ID ${unitId}.`);
            await (0, catalogSync_1.syncCatalogs)();
            res.json({ message: "Room deleted successfully" });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}
exports.UnitController = UnitController;
// Utility function to calculate availability
async function calculateAvailability(unitId) {
    try {
        const daysInMonth = 30;
        const totalSeconds = daysInMonth * 24 * 60 * 60; // 2,592,000 seconds
        // Sum total downtime in the last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - daysInMonth);
        const dateStr = thirtyDaysAgo.toISOString().substring(0, 10);
        const downtimeRow = await db_1.query.get(`SELECT SUM(
        CASE 
          WHEN fechaFin IS NULL THEN strftime('%s', 'now') - strftime('%s', fechaInicio || ' ' || horaInicio)
          ELSE duracionSegundos 
        END
       ) AS totalDowntime
       FROM tickets 
       WHERE unitId = ? AND fechaInicio >= ?`, [unitId, dateStr]);
        const downtime = downtimeRow?.totalDowntime || 0;
        if (downtime >= totalSeconds)
            return 0.00;
        const availability = ((totalSeconds - downtime) / totalSeconds) * 100;
        return parseFloat(availability.toFixed(2));
    }
    catch {
        return 100.00;
    }
}
