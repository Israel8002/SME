"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogController = void 0;
const db_1 = require("../config/db");
class LogController {
    static async getLogs(req, res) {
        try {
            const search = req.query.search ? `%${req.query.search}%` : "%";
            const nivel = req.query.nivel || "";
            const modulo = req.query.modulo || "";
            const dateStart = req.query.dateStart || "";
            const dateEnd = req.query.dateEnd || "";
            const sortColumn = req.query.sortColumn || "fechaHora";
            const sortOrder = req.query.sortOrder === "asc" ? "ASC" : "DESC";
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 50;
            const offset = (page - 1) * limit;
            let sql = `
        SELECT * FROM logs 
        WHERE (evento LIKE ? OR descripcion LIKE ? OR usuario LIKE ?)
      `;
            const params = [search, search, search];
            if (nivel) {
                sql += " AND nivel = ?";
                params.push(nivel);
            }
            if (modulo) {
                sql += " AND modulo = ?";
                params.push(modulo);
            }
            if (dateStart) {
                sql += " AND fechaHora >= ?";
                params.push(dateStart);
            }
            if (dateEnd) {
                sql += " AND fechaHora <= ?";
                params.push(dateEnd);
            }
            const allowedColumns = ["id", "fechaHora", "nivel", "modulo", "evento", "usuario"];
            const actualSortColumn = allowedColumns.includes(sortColumn) ? sortColumn : "fechaHora";
            sql += ` ORDER BY ${actualSortColumn} ${sortOrder}`;
            const countSql = `SELECT COUNT(*) as total FROM (${sql})`;
            const totalRow = await db_1.query.get(countSql, params);
            const total = totalRow ? totalRow.total : 0;
            sql += " LIMIT ? OFFSET ?";
            params.push(limit, offset);
            const rows = await db_1.query.all(sql, params);
            res.json({
                data: rows,
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
}
exports.LogController = LogController;
