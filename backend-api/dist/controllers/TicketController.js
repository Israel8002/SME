"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TicketController = void 0;
const db_1 = require("../config/db");
const logger_1 = require("../config/logger");
class TicketController {
    static async getTickets(req, res) {
        try {
            const search = req.query.search ? `%${req.query.search}%` : "%";
            const unitId = req.query.unitId || "";
            const cityId = req.query.cityId || "";
            const tipo = req.query.tipo || "";
            const estado = req.query.estado || "";
            const dateStart = req.query.dateStart || "";
            const dateEnd = req.query.dateEnd || "";
            const durationMin = parseInt(req.query.durationMin) || 0;
            const durationMax = parseInt(req.query.durationMax) || 0;
            const sortColumn = req.query.sortColumn || "fechaInicio";
            const sortOrder = req.query.sortOrder === "asc" ? "ASC" : "DESC";
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const offset = (page - 1) * limit;
            let sql = `
        SELECT 
          t.*, 
          u.nombre AS unidadNombre,
          c.nombre AS ciudadNombre,
          u.tipo AS unidadTipo
        FROM tickets t
        JOIN units u ON t.unitId = u.id
        JOIN cities c ON u.cityId = c.id
        WHERE (t.folio LIKE ? OR u.nombre LIKE ? OR t.motivo LIKE ?)
      `;
            const params = [search, search, search];
            if (unitId) {
                sql += " AND t.unitId = ?";
                params.push(unitId);
            }
            if (cityId) {
                sql += " AND u.cityId = ?";
                params.push(cityId);
            }
            if (tipo) {
                sql += " AND u.tipo = ?";
                params.push(tipo);
            }
            if (estado) {
                sql += " AND t.estado = ?";
                params.push(estado);
            }
            if (dateStart) {
                sql += " AND t.fechaInicio >= ?";
                params.push(dateStart);
            }
            if (dateEnd) {
                sql += " AND t.fechaInicio <= ?";
                params.push(dateEnd);
            }
            if (durationMin > 0) {
                sql += " AND t.duracionSegundos >= ?";
                params.push(durationMin);
            }
            if (durationMax > 0) {
                sql += " AND t.duracionSegundos <= ?";
                params.push(durationMax);
            }
            // Sort column whitelist
            const allowedColumns = ["id", "folio", "fechaInicio", "horaInicio", "duracionSegundos", "estado", "unidadNombre", "ciudadNombre"];
            const actualSortColumn = allowedColumns.includes(sortColumn) ? sortColumn : "fechaInicio";
            sql += ` ORDER BY ${actualSortColumn} ${sortOrder}`;
            // Get count
            const countSql = `SELECT COUNT(*) as total FROM (${sql})`;
            const totalRow = await db_1.query.get(countSql, params);
            const total = totalRow ? totalRow.total : 0;
            // Add pagination
            sql += " LIMIT ? OFFSET ?";
            params.push(limit, offset);
            const rows = await db_1.query.all(sql, params);
            // Map dynamic duration label in response
            const mappedRows = rows.map(t => ({
                ...t,
                duracionLegible: formatDuration(t.duracionSegundos, t.estado === "Abierto", t.fechaInicio, t.horaInicio)
            }));
            res.json({
                data: mappedRows,
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
    static async getTicketDetail(req, res) {
        try {
            const ticketId = req.params.id;
            const ticket = await db_1.query.get(`SELECT t.*, u.nombre AS unidadNombre, c.nombre AS ciudadNombre, u.tipo AS unidadTipo
         FROM tickets t
         JOIN units u ON t.unitId = u.id
         JOIN cities c ON u.cityId = c.id
         WHERE t.id = ?`, [ticketId]);
            if (!ticket) {
                return res.status(404).json({ error: "Ticket not found" });
            }
            // Fetch associated ticket details (failing IPs)
            const details = await db_1.query.all(`SELECT td.*, ip.direccionIP, ip.descripcion AS ipDescripcion
         FROM ticket_details td
         JOIN unit_ips ip ON td.ipId = ip.id
         WHERE td.ticketId = ?`, [ticketId]);
            res.json({
                ...ticket,
                duracionLegible: formatDuration(ticket.duracionSegundos, ticket.estado === "Abierto", ticket.fechaInicio, ticket.horaInicio),
                details
            });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    static async closeTicket(req, res) {
        try {
            const ticketId = parseInt(req.params.id);
            const { observaciones } = req.body;
            const ticket = await db_1.query.get("SELECT * FROM tickets WHERE id = ?", [ticketId]);
            if (!ticket) {
                return res.status(404).json({ error: "Ticket not found" });
            }
            if (ticket.estado === "Cerrado") {
                return res.status(400).json({ error: "Ticket is already closed" });
            }
            const nowISO = new Date().toISOString();
            const today = nowISO.substring(0, 10);
            const timeNow = nowISO.substring(11, 19);
            let duracionSegundos = 0;
            try {
                const start = new Date(`${ticket.fechaInicio}T${ticket.horaInicio}`);
                duracionSegundos = Math.max(0, Math.floor((new Date().getTime() - start.getTime()) / 1000));
            }
            catch (err) {
                console.error("Error parsing start time:", err);
            }
            await db_1.query.transaction(async () => {
                await db_1.query.run(`UPDATE ticket_details SET estadoFinal = 'ONLINE' WHERE ticketId = ? AND estadoFinal IS NULL`, [ticketId]);
                await db_1.query.run(`UPDATE tickets SET 
            estado = 'Cerrado', 
            fechaFin = ?, 
            horaFin = ?, 
            duracionSegundos = ?, 
            observaciones = ?
           WHERE id = ?`, [today, timeNow, duracionSegundos, observaciones || "Cierre manual por administrador", ticketId]);
            });
            await (0, logger_1.logEvent)(logger_1.LogLevel.INFO, "Tickets", "Cierre Ticket", `Ticket con folio ${ticket.folio} cerrado manualmente. Observaciones: ${observaciones || "Cierre manual por administrador"}`);
            res.json({ message: "Ticket closed successfully" });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    static async deleteTicket(req, res) {
        try {
            const id = parseInt(req.params.id);
            const ticket = await db_1.query.get("SELECT folio FROM tickets WHERE id = ?", [id]);
            if (!ticket) {
                return res.status(404).json({ error: "Ticket not found" });
            }
            await db_1.query.transaction(async () => {
                await db_1.query.run("DELETE FROM ticket_details WHERE ticketId = ?", [id]);
                await db_1.query.run("DELETE FROM tickets WHERE id = ?", [id]);
            });
            await (0, logger_1.logEvent)(logger_1.LogLevel.WARNING, "Tickets", "Baja Ticket", `Ticket con folio ${ticket.folio} eliminado manualmente.`);
            res.json({ message: "Ticket deleted successfully" });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    static async deleteTicketsByRange(req, res) {
        try {
            const { startDate, endDate } = req.body;
            if (!startDate || !endDate) {
                return res.status(400).json({ error: "Missing startDate or endDate in request body" });
            }
            await db_1.query.transaction(async () => {
                await db_1.query.run(`DELETE FROM ticket_details WHERE ticketId IN (
            SELECT id FROM tickets WHERE fechaInicio >= ? AND fechaInicio <= ?
          )`, [startDate, endDate]);
                await db_1.query.run("DELETE FROM tickets WHERE fechaInicio >= ? AND fechaInicio <= ?", [startDate, endDate]);
            });
            await (0, logger_1.logEvent)(logger_1.LogLevel.WARNING, "Tickets", "Baja Rango", `Tickets en el rango ${startDate} al ${endDate} eliminados del sistema.`);
            res.json({ message: "Tickets in date range deleted successfully" });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}
exports.TicketController = TicketController;
function formatDuration(sec, isOpen, startDateStr, startTimeStr) {
    let seconds = sec;
    if (isOpen) {
        // Calculate running seconds since start time
        try {
            const start = new Date(`${startDateStr}T${startTimeStr}`);
            seconds = Math.max(0, Math.floor((new Date().getTime() - start.getTime()) / 1000));
        }
        catch {
            seconds = 0;
        }
    }
    if (seconds === 0)
        return "0 segundos";
    const days = Math.floor(seconds / (24 * 3600));
    seconds %= (24 * 3600);
    const hours = Math.floor(seconds / 3600);
    seconds %= 3600;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const parts = [];
    if (days > 0)
        parts.push(`${days} día${days > 1 ? "s" : ""}`);
    if (hours > 0)
        parts.push(`${hours} hora${hours > 1 ? "s" : ""}`);
    if (minutes > 0)
        parts.push(`${minutes} minuto${minutes > 1 ? "s" : ""}`);
    if (secs > 0 || parts.length === 0)
        parts.push(`${secs} segundo${secs > 1 ? "s" : ""}`);
    return parts.join(", ");
}
