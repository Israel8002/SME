import { Request, Response } from "express";
import { query } from "../config/db";

export class LogController {
  static async getLogs(req: Request, res: Response) {
    try {
      const search = req.query.search ? `%${req.query.search}%` : "%";
      const nivel = req.query.nivel || "";
      const modulo = req.query.modulo || "";
      const dateStart = req.query.dateStart || "";
      const dateEnd = req.query.dateEnd || "";

      const sortColumn = req.query.sortColumn || "fechaHora";
      const sortOrder = req.query.sortOrder === "asc" ? "ASC" : "DESC";

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = (page - 1) * limit;

      let sql = `
        SELECT * FROM logs 
        WHERE (evento LIKE ? OR descripcion LIKE ? OR usuario LIKE ?)
      `;
      const params: any[] = [search, search, search];

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
      const actualSortColumn = allowedColumns.includes(sortColumn as string) ? sortColumn : "fechaHora";

      sql += ` ORDER BY ${actualSortColumn} ${sortOrder}`;

      const countSql = `SELECT COUNT(*) as total FROM (${sql})`;
      const totalRow = await query.get<{ total: number }>(countSql, params);
      const total = totalRow ? totalRow.total : 0;

      sql += " LIMIT ? OFFSET ?";
      params.push(limit, offset);

      const rows = await query.all<any>(sql, params);

      res.json({
        data: rows,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async clearLogs(req: Request, res: Response) {
    try {
      await query.run("DELETE FROM logs");
      
      const timestamp = new Date().toISOString();
      await query.run(
        `INSERT INTO logs (fechaHora, nivel, modulo, evento, descripcion, usuario, ipEquipo, versionSistema)
         VALUES (?, 'INFO', 'Logs', 'Depuración', 'Limpieza general de logs realizada por el administrador.', 'Administrador', '127.0.0.1', '1.2.0')`,
        [timestamp]
      );

      res.json({ message: "Logs limpiados exitosamente" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
